"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";

type Rate = {
  id: string;
  carrier: string;
  service: string;
  rate: string;
  currency: string;
  delivery_days: number | null;
  retail_rate?: string | null;
};

const emptyForm = {
  to_name: "",
  to_street1: "",
  to_street2: "",
  to_city: "",
  to_state: "",
  to_zip: "",
  to_country: "US",
  to_phone: "",
  to_email: "",
  length: 14,
  width: 17,
  height: 1,
  weight_lb: "",
  weight_oz: "",
  signature_confirmation: false,
  notes: "",
  customer_id: null as string | null,
  basket_number: "" as string, // live-sale basket to link (optional)
  reference: "" as string, // prints on the label + saved on the order
};

// Coerce anything (including "" or NaN) to a safe number so numeric
// columns never receive an empty string, which Postgres rejects.
function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

const CARRIER_COLORS: Record<string, string> = {
  UPS: "bg-[#351c15] text-[#ffb500]",
  USPS: "bg-[#333366] text-white",
  FedEx: "bg-[#4d148c] text-[#ff6600]",
};

function CarrierMark({ carrier }: { carrier: string }) {
  return (
    <span
      className={`flex h-7 w-9 items-center justify-center rounded-md text-[9px] font-bold tracking-tight ${
        CARRIER_COLORS[carrier] || "bg-taupe/15 text-taupe"
      }`}
    >
      {carrier.toUpperCase().slice(0, 5)}
    </span>
  );
}

function CreateLabelInner() {
  const router = useRouter();
  const params = useSearchParams();
  const draftId = params.get("draft");
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [form, setForm] = useState({ ...emptyForm });
  const [orderId, setOrderId] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [provider, setProvider] = useState<"easypost" | "shippo" | "shipstation" | "easyship">("shippo");
  const [rates, setRates] = useState<Rate[]>([]);
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [oneClick, setOneClick] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    (async () => {
      const { data } = await supabase.from("shipping_orders").select("*").eq("id", draftId).single();
      if (data) {
        setOrderId(data.id);
        setManual(true);
        setForm({
          to_name: data.to_name ?? "",
          to_street1: data.to_street1 ?? "",
          to_street2: data.to_street2 ?? "",
          to_city: data.to_city ?? "",
          to_state: data.to_state ?? "",
          to_zip: data.to_zip ?? "",
          to_country: data.to_country ?? "US",
          to_phone: data.to_phone ?? "",
          to_email: data.to_email ?? "",
          length: data.length ?? 14,
          width: data.width ?? 17,
          height: data.height ?? 1,
          weight_lb: data.weight_lb ?? "",
          weight_oz: data.weight_oz ?? "",
          signature_confirmation: data.signature_confirmation ?? false,
          notes: data.notes ?? "",
          customer_id: data.customer_id,
          basket_number: "", // drafts don't carry a basket number to restore
          reference:
            data.reference ??
            (data.order_number != null ? `EB-${data.order_number}` : ""),
        });
      }
    })();
  }, [draftId, supabase]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("shipping_customers")
        .select("*")
        .eq("archived", false)
        .or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(6);
      setResults(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [search, supabase]);

  function pickCustomer(c: any) {
    setForm((f) => ({
      ...f,
      customer_id: c.id,
      to_name: c.name ?? "",
      to_street1: c.street1 ?? "",
      to_street2: c.street2 ?? "",
      to_city: c.city ?? "",
      to_state: c.state ?? "",
      to_zip: c.zip ?? "",
      to_country: c.country ?? "US",
      to_phone: c.phone ?? "",
      to_email: c.email ?? "",
    }));
    setSearch("");
    setResults([]);
    setManual(true);
    setRates([]);
    setSelectedRate(null);
  }

  function set(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
    setRates([]);
    setSelectedRate(null);
  }

  // Build a DB-safe payload: numeric columns always get real numbers,
  // empty optional text stays null-friendly.
  function buildPayload() {
    // basket_number is a UI-only field for linking — it isn't a column on
    // shipping_orders, so strip it out before writing the order. reference
    // IS a column, so it stays in and gets saved.
    const { basket_number, ...orderFields } = form;
    return {
      ...orderFields,
      length: toNum(form.length),
      width: toNum(form.width),
      height: toNum(form.height),
      weight_lb: toNum(form.weight_lb),
      weight_oz: toNum(form.weight_oz),
      status: "draft",
    };
  }

  async function saveDraft(silent = false): Promise<string> {
    setError(null);
    if (!silent) setBusy("draft");
    const payload = buildPayload();
    try {
      let id = orderId;
      if (id) {
        const { error } = await supabase.from("shipping_orders").update(payload).eq("id", id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from("shipping_orders")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        id = data.id;
        setOrderId(data.id);
      }
      return id as string;
    } finally {
      if (!silent) setBusy(null);
    }
  }

  async function getRates() {
    setError(null);
    setBusy("rates");
    setRates([]);
    setSelectedRate(null);
    try {
      const res = await fetch("/api/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          to: {
            name: form.to_name,
            street1: form.to_street1,
            street2: form.to_street2 || undefined,
            city: form.to_city,
            state: form.to_state,
            zip: form.to_zip,
            country: form.to_country,
            phone: form.to_phone || undefined,
            email: form.to_email || undefined,
          },
          parcel: {
            length: toNum(form.length),
            width: toNum(form.width),
            height: toNum(form.height),
            weight_lb: toNum(form.weight_lb),
            weight_oz: toNum(form.weight_oz),
          },
          signature: form.signature_confirmation,
          reference: form.reference || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShipmentId(data.shipment_id);
      setRates(data.rates);
      if (!data.rates.length) setError("No rates returned — check the address and weight.");
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(null);
  }

  async function buy(rate: Rate) {
    setError(null);
    setBusy(rate.id);
    try {
      // saveDraft now throws the real Supabase error if it fails,
      // so we no longer mask it with a generic message.
      const id = await saveDraft(true);
      const res = await fetch("/api/labels/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: id,
          shipment_id: shipmentId,
          rate_id: rate.id,
          provider,
          reference: form.reference || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // If a basket number was entered, link that basket (from the most
      // recent live sale) to this order so tracking reaches their portal.
      // Best-effort: a failed link never blocks the ship — the label's
      // already bought.
      const bn = parseInt(String(form.basket_number), 10);
      if (Number.isInteger(bn) && bn > 0) {
        try {
          await fetch("/api/live/link-basket", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ basket_number: bn, order_id: id }),
          });
        } catch {
          // ignore — nothing here is worth stopping the redirect for
        }
      }

      router.push("/");
    } catch (e: any) {
      setError(e.message);
      setBusy(null);
    }
  }

  function onRateClick(rate: Rate) {
    if (oneClick) {
      buy(rate);
    } else {
      setSelectedRate(rate);
    }
  }

  const canRate =
    form.to_name && form.to_street1 && form.to_city && form.to_state && form.to_zip &&
    (Number(form.weight_lb) > 0 || Number(form.weight_oz) > 0);

  const carriers = Array.from(new Set(rates.map((r) => r.carrier)));

  return (
    <Shell>
      {/* One-click toggle */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => setOneClick(!oneClick)}
          aria-pressed={oneClick}
          className={`relative h-7 w-12 rounded-full transition-colors ${oneClick ? "bg-taupe" : "bg-sand/60"}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${oneClick ? "left-6" : "left-1"}`}
          />
        </button>
        <span className="font-heading text-xl text-taupe">
          One-Click Purchase {oneClick ? "On" : "Off"}
        </span>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr_0.9fr]">
        {/* Column 1: address + packaging */}
        <div className="space-y-5">
          <div className="card !rounded-[2rem]">
            <h2 className="text-center text-2xl">1. 📍 Address Information</h2>
            <div className="relative mt-5">
              <input
                className="input"
                placeholder="Search Existing Customers 👤"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl border border-taupe/20 bg-white shadow-lg">
                  {results.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => pickCustomer(c)}
                      className="block w-full px-4 py-2.5 text-left text-sm hover:bg-cream"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-2 text-ink/60">
                        {[c.city, c.state].filter(Boolean).join(", ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live-sale basket link (optional) */}
            <div className="mt-4">
              <label className="label">
                Basket # <span className="text-ink/40">(from this week&#39;s live — optional)</span>
              </label>
              <input
                className="input"
                inputMode="numeric"
                placeholder="e.g. 12"
                value={form.basket_number}
                onChange={(e) => set("basket_number", e.target.value.replace(/\D/g, ""))}
              />
              <p className="mt-1 text-xs text-ink/50">
                Links this shipment to that basket so tracking shows on the customer&#39;s portal.
              </p>
            </div>

            {/* Reference — prints on the label and saves on the order. */}
            <div className="mt-4">
              <label className="label">
                Reference # <span className="text-ink/40">(prints on label — optional)</span>
              </label>
              <input
                className="input"
                placeholder="EB-000"
                value={form.reference}
                onChange={(e) => set("reference", e.target.value)}
              />
              <p className="mt-1 text-xs text-ink/50">
                Defaults to the order number. Edit it to print anything you like on the label.
              </p>
            </div>

            {!manual ? (
              <button
                onClick={() => setManual(true)}
                className="mt-4 w-full text-center text-sm text-taupe underline underline-offset-2"
              >
                Enter Address Manually
              </button>
            ) : (
              <div className="mt-4 grid gap-3">
                <div>
                  <label className="label">Name</label>
                  <input className="input" value={form.to_name} onChange={(e) => set("to_name", e.target.value)} />
                </div>
                <div>
                  <label className="label">Street</label>
                  <input className="input" value={form.to_street1} onChange={(e) => set("to_street1", e.target.value)} />
                </div>
                <div>
                  <label className="label">Apt / Suite (optional)</label>
                  <input className="input" value={form.to_street2} onChange={(e) => set("to_street2", e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="label">City</label>
                    <input className="input" value={form.to_city} onChange={(e) => set("to_city", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">State</label>
                    <input className="input" maxLength={2} value={form.to_state} onChange={(e) => set("to_state", e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <label className="label">ZIP</label>
                    <input className="input" value={form.to_zip} onChange={(e) => set("to_zip", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" value={form.to_phone} onChange={(e) => set("to_phone", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input className="input" value={form.to_email} onChange={(e) => set("to_email", e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card !rounded-[2rem]">
            <h2 className="text-center text-2xl">2. Choose Packaging</h2>
            <div className="mt-5 rounded-2xl border-2 border-taupe/60 bg-cream/50 px-5 py-4 text-center font-medium">
             📦 Box / My Packaging
            </div>
            <div className="mt-5 flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm font-medium">Dimensions</span>
              <input type="number" className="input !px-2 text-center" value={form.length} onChange={(e) => set("length", Number(e.target.value))} />
              <input type="number" className="input !px-2 text-center" value={form.width} onChange={(e) => set("width", Number(e.target.value))} />
              <input type="number" className="input !px-2 text-center" value={form.height} onChange={(e) => set("height", Number(e.target.value))} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm font-medium">Weight</span>
              <div className="relative flex-1">
                <input type="number" min={0} className="input !px-2 text-center" value={form.weight_lb} onChange={(e) => set("weight_lb", Number(e.target.value))} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/50">lbs</span>
              </div>
              <div className="relative flex-1">
                <input type="number" min={0} step={0.1} className="input !px-2 text-center" value={form.weight_oz} onChange={(e) => set("weight_oz", Number(e.target.value))} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/50">oz</span>
              </div>
            </div>
            <button
              onClick={getRates}
              disabled={!canRate || busy !== null}
              className="btn-primary mt-6 w-full !py-3"
            >
              {busy === "rates" ? "Getting Rates…" : "Get Rates"}
            </button>
            {!canRate && (
              <p className="mt-3 text-center text-xs text-ink/50">
                Enter a full address and a weight above 0.
              </p>
            )}
          </div>
        </div>

        {/* Column 2: shipping method */}
        <div className="card !rounded-[2rem]">
          <h2 className="text-center text-2xl">3. Choose Shipping Method</h2>

          {rates.length === 0 ? (
            <div className="mt-14 text-center">
              <svg viewBox="0 0 64 48" className="mx-auto w-24 text-sand" aria-hidden>
                <rect x="8" y="14" width="28" height="20" rx="2" fill="currentColor" opacity="0.5" />
                <rect x="14" y="8" width="16" height="10" rx="2" fill="currentColor" />
                <circle cx="16" cy="40" r="4" fill="currentColor" />
                <path d="M44 34h12M44 28h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="mx-auto mt-4 max-w-[220px] text-sm text-ink/60">
                Enter destination info and get rates to see shipping options.
              </p>
            </div>
          ) : (
            <div className="mt-5">
              <p className="font-heading text-xl text-taupe">Best Rates</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(() => {
                  const sorted = [...rates].sort((a, b) => Number(a.rate) - Number(b.rate));
                  const cheapestId = sorted[0]?.id;
                  const withDays = sorted.filter((r) => r.delivery_days != null);
                  const fastestId = withDays.length
                    ? withDays.reduce((min, r) =>
                        (r.delivery_days as number) < (min.delivery_days as number) ? r : min
                      ).id
                    : null;
                  return sorted.map((r) => {
                    const active = selectedRate?.id === r.id;
                    const retail =
                      r.retail_rate && Number(r.retail_rate) > Number(r.rate)
                        ? Number(r.retail_rate).toFixed(2)
                        : null;
                    return (
                      <div key={r.id} className="relative">
                        {r.id === cheapestId && (
                          <span className="absolute -top-2.5 left-4 z-10 rounded-full border border-taupe/40 bg-cream px-2.5 py-0.5 text-[10px] font-medium text-taupe">
                            Recommended
                          </span>
                        )}
                        {r.id === fastestId && r.id !== cheapestId && (
                          <span className="absolute -top-2.5 left-4 z-10 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-medium text-amber-800">
                            Fastest
                          </span>
                        )}
                        <button
                          onClick={() => onRateClick(r)}
                          disabled={busy !== null}
                          className={`w-full rounded-2xl border p-4 text-left transition-colors disabled:opacity-50 ${
                            active
                              ? "border-taupe bg-taupe/10"
                              : "border-taupe/20 bg-white hover:border-taupe/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-ink/50">
                              {r.delivery_days
                                ? `${r.delivery_days} Day${r.delivery_days === 1 ? "" : "s"}`
                                : "Estimate n/a"}
                            </p>
                            <CarrierMark carrier={r.carrier} />
                          </div>
                          <p className="mt-1 text-sm font-semibold leading-snug">{r.service}</p>
                          <div className="mt-2 flex items-baseline justify-between gap-2">
                            {retail ? (
                              <span className="text-sm text-ink/40 line-through">${retail}</span>
                            ) : (
                              <span />
                            )}
                            <span className="font-heading text-2xl text-taupe">
                              {busy === r.id ? "Buying…" : `$${r.rate}`}
                            </span>
                          </div>
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>

              {!oneClick && (
                <button
                  onClick={() => selectedRate && buy(selectedRate)}
                  disabled={!selectedRate || busy !== null}
                  className="btn-primary mt-5 w-full !py-3"
                >
                  {selectedRate
                    ? busy === selectedRate.id
                      ? "Buying…"
                      : `Buy ${selectedRate.carrier} ${selectedRate.service} — $${selectedRate.rate}`
                    : "Select a rate above"}
                </button>
              )}
              {oneClick && (
                <p className="mt-4 text-center text-xs text-ink/50">
                  One-click is on — clicking a rate buys the label immediately.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Column 3: additional options */}
        <div className="card h-fit !rounded-[2rem]">
          <h2 className="text-2xl">Additional Options</h2>

          <div className="mt-5">
            <label className="label">Shipping Provider</label>
            <select
              className="input"
              value={provider}
              onChange={(e) => { setProvider(e.target.value as any); setRates([]); setSelectedRate(null); }}
            >
              <option value="shippo">Shippo</option>
              <option value="easypost">EasyPost</option>
              <option value="easyship">EasyShip</option>
              <option value="shipstation">ShipStation</option>
            </select>
          </div>

          <label className="mt-5 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-taupe"
              checked={form.signature_confirmation}
              onChange={(e) => set("signature_confirmation", e.target.checked)}
            />
            Require Signature ✍️
          </label>

          <div className="mt-5">
            <label className="label">Order Notes 📝 </label>
            <textarea
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="my-5 h-px bg-taupe/15" />

          <button
            onClick={() => saveDraft().catch((e: any) => setError(e.message))}
            disabled={busy !== null}
            className="btn-secondary w-full"
          >
            {busy === "draft" ? "Saving…" : orderId ? "Update Draft" : "Save Draft"}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-ink/50">
            Drafts can be continued later from the Orders page.
          </p>
        </div>
      </div>
    </Shell>
  );
}

export default function CreateLabelPage() {
  return (
    <Suspense>
      <CreateLabelInner />
    </Suspense>
  );
}
