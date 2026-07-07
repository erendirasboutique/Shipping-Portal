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
  weight_lb: 0,
  weight_oz: 0,
  signature_confirmation: false,
  notes: "",
  customer_id: null as string | null,
};

function CreateLabelInner() {
  const router = useRouter();
  const params = useSearchParams();
  const draftId = params.get("draft");
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [form, setForm] = useState({ ...emptyForm });
  const [orderId, setOrderId] = useState<string | null>(null);
  const [provider, setProvider] = useState<"easypost" | "shippo" | "shipstation">("easypost");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load draft when continuing from Orders
  useEffect(() => {
    if (!draftId) return;
    (async () => {
      const { data } = await supabase.from("shipping_orders").select("*").eq("id", draftId).single();
      if (data) {
        setOrderId(data.id);
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
          weight_lb: data.weight_lb ?? 0,
          weight_oz: data.weight_oz ?? 0,
          signature_confirmation: data.signature_confirmation ?? false,
          notes: data.notes ?? "",
          customer_id: data.customer_id,
        });
      }
    })();
  }, [draftId, supabase]);

  // Customer search
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
  }

  function set(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
    setRates([]); // address/parcel changed → rates stale
  }

  async function saveDraft(silent = false): Promise<string | null> {
    setError(null);
    if (!silent) setBusy("draft");
    const payload = { ...form, status: "draft" };
    let id = orderId;
    if (id) {
      const { error } = await supabase.from("shipping_orders").update(payload).eq("id", id);
      if (error) setError(error.message);
    } else {
      const { data, error } = await supabase.from("shipping_orders").insert(payload).select("id").single();
      if (error) setError(error.message);
      if (data) {
        id = data.id;
        setOrderId(data.id);
      }
    }
    if (!silent) setBusy(null);
    return id;
  }

  async function getRates() {
    setError(null);
    setBusy("rates");
    setRates([]);
    try {
      const res = await fetch("/api/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
            length: form.length,
            width: form.width,
            height: form.height,
            weight_lb: form.weight_lb,
            weight_oz: form.weight_oz,
          },
          signature: form.signature_confirmation,
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
      const id = await saveDraft(true);
      if (!id) throw new Error("Could not save order before purchase");
      const res = await fetch("/api/labels/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: id, shipment_id: shipmentId, rate_id: rate.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/"); // redirect home after successful purchase
    } catch (e: any) {
      setError(e.message);
      setBusy(null);
    }
  }

  const canRate =
    form.to_name && form.to_street1 && form.to_city && form.to_state && form.to_zip &&
    (Number(form.weight_lb) > 0 || Number(form.weight_oz) > 0);

  return (
    <Shell>
      <h1 className="text-3xl">Create Label</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Customer search */}
          <div className="card">
            <h2 className="text-lg">Ship to</h2>
            <div className="relative mt-3">
              <input
                className="input"
                placeholder="Search saved customers by name, email, or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-sand bg-white shadow-soft">
                  {results.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => pickCustomer(c)}
                      className="block w-full px-4 py-2.5 text-left text-sm hover:bg-sand/30"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-2 text-ink/60">
                        {[c.city, c.state].filter(Boolean).join(", ")} {c.email ? `· ${c.email}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Name</label>
                <input className="input" value={form.to_name} onChange={(e) => set("to_name", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Street</label>
                <input className="input" value={form.to_street1} onChange={(e) => set("to_street1", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Apt / Suite (optional)</label>
                <input className="input" value={form.to_street2} onChange={(e) => set("to_street2", e.target.value)} />
              </div>
              <div>
                <label className="label">City</label>
                <input className="input" value={form.to_city} onChange={(e) => set("to_city", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">State</label>
                  <input className="input" maxLength={2} value={form.to_state} onChange={(e) => set("to_state", e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className="label">ZIP</label>
                  <input className="input" value={form.to_zip} onChange={(e) => set("to_zip", e.target.value)} />
                </div>
              </div>
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

          {/* Package */}
          <div className="card">
            <h2 className="text-lg">Package</h2>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <label className="label">Length (in)</label>
                <input type="number" className="input" value={form.length} onChange={(e) => set("length", Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Width (in)</label>
                <input type="number" className="input" value={form.width} onChange={(e) => set("width", Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Height (in)</label>
                <input type="number" className="input" value={form.height} onChange={(e) => set("height", Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Weight (lb)</label>
                <input type="number" min={0} className="input" value={form.weight_lb} onChange={(e) => set("weight_lb", Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Weight (oz)</label>
                <input type="number" min={0} step={0.1} className="input" value={form.weight_oz} onChange={(e) => set("weight_oz", Number(e.target.value))} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-taupe"
                    checked={form.signature_confirmation}
                    onChange={(e) => set("signature_confirmation", e.target.checked)}
                  />
                  Signature confirmation
                </label>
              </div>
            </div>
            <div className="mt-4">
              <label className="label">Order notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="mt-4">
              <label className="label">Shipping provider</label>
              <select
                className="input"
                value={provider}
                onChange={(e) => { setProvider(e.target.value as any); setRates([]); }}
              >
                <option value="easypost">EasyPost</option>
                <option value="shippo">Shippo</option>
                <option value="pitneybowes">Pitney Bowes</option>
              </select>
            </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={() => saveDraft()} disabled={busy !== null} className="btn-secondary">
              {busy === "draft" ? "Saving…" : orderId ? "Update draft" : "Save draft"}
            </button>
            <button onClick={getRates} disabled={!canRate || busy !== null} className="btn-primary">
              {busy === "rates" ? "Getting rates…" : "Get rates"}
            </button>
          </div>
          {!canRate && (
            <p className="text-sm text-taupe/70">Enter a full address and a weight above 0 to get rates.</p>
          )}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        </div>

        {/* Rates */}
        <div className="card h-fit">
          <h2 className="text-lg">Rates</h2>
          {rates.length === 0 ? (
            <p className="mt-3 text-sm text-ink/60">
              Rates from USPS, UPS, and FedEx will appear here.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {rates.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-xl border border-sand/60 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {r.carrier} · {r.service}
                    </p>
                    <p className="text-xs text-ink/60">
                      {r.delivery_days ? `${r.delivery_days} day${r.delivery_days === 1 ? "" : "s"}` : "Delivery estimate unavailable"}
                    </p>
                  </div>
                  <button onClick={() => buy(r)} disabled={busy !== null} className="btn-primary !px-4 !py-2">
                    {busy === r.id ? "Buying…" : `Buy $${r.rate}`}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
