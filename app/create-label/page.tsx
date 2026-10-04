"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Shell from "@/components/Shell";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import ScaleReader from "@/components/ScaleReader";
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

// Your everyday package. New labels start with this size.
const MY_BOX = { length: 14, width: 17, height: 1 };

// Standard #10 business envelope (9½ × 4⅛ in). Ships as a USPS letter.
const ENVELOPE_10 = { length: 9.5, width: 4.125, height: 0.25 };
// USPS letter-rate limit; heavier envelopes are priced as flats.
const LETTER_MAX_OZ = 3.5;

type PackageType = "box" | "envelope";

const PACKAGES: { id: PackageType; name: string; size: string }[] = [
  { id: "box", name: "My Packaging", size: "14 × 17 × 1 in" },
  { id: "envelope", name: "Envelope #10", size: "9½ × 4⅛ in · letter" },
];

// Shown in the "From" corner of the label preview. Edit to match your return address.
const FROM_LINES = ["ERENDIRA'S BOUTIQUE"];

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
  length: MY_BOX.length,
  width: MY_BOX.width,
  height: MY_BOX.height,
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
  Amazon: "bg-[#232f3e] text-[#ff9900]",
  OnTrac: "bg-[#003a70] text-[#f7a800]",
};

// Short badge text for carriers whose names don't shorten cleanly.
const CARRIER_SHORT: Record<string, string> = {
  Amazon: "AMZN",
  OnTrac: "ONTRC",
};

function CarrierMark({ carrier }: { carrier: string }) {
  return (
    <span
      className={`flex h-7 w-9 items-center justify-center rounded-md text-[9px] font-bold tracking-tight ${
        CARRIER_COLORS[carrier] || "bg-taupe/15 text-taupe"
      }`}
    >
      {CARRIER_SHORT[carrier] || carrier.toUpperCase().slice(0, 5)}
    </span>
  );
}

// Big service letter in the corner of a real USPS label (P, G, E, F…)
function serviceLetter(service?: string, carrier?: string) {
  const s = (service || "").toLowerCase();
  if (s.includes("express")) return "E";
  if (s.includes("priority")) return "P";
  if (s.includes("ground")) return "G";
  if (s.includes("first")) return "F";
  if (s.includes("media")) return "M";
  return (carrier || "").charAt(0).toUpperCase() || "–";
}

function formatWeight(lb: unknown, oz: unknown) {
  const l = toNum(lb);
  const o = toNum(oz);
  if (!l && !o) return "";
  return [l ? `${l} LB` : "", o ? `${o} OZ` : ""].filter(Boolean).join(" ");
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-2xl">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-taupe/10 font-heading text-lg text-taupe">
        {n}
      </span>
      {children}
    </h2>
  );
}

/* ---------- Label preview (4×6) ---------- */

function LabelPreview({
  form,
  rate,
  signature,
  envelope,
}: {
  form: typeof emptyForm;
  rate: Rate | null;
  signature: boolean;
  envelope: boolean;
}) {
  if (envelope) return <EnvelopePreview form={form} rate={rate} />;
  const weight = formatWeight(form.weight_lb, form.weight_oz);
  const hasAddress = !!(form.to_name || form.to_street1);
  const cityLine = [form.to_city, [form.to_state, form.to_zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" ");
  const letter = rate ? serviceLetter(rate.service, rate.carrier) : "";
  const muted = "text-ink/25";

  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div className="relative aspect-[4/6] overflow-hidden rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_12px_30px_-8px_rgba(80,60,40,.25)] ring-1 ring-ink/10">
        <div className="flex h-full flex-col font-mono text-[10px] leading-snug text-ink">
          {/* Service band */}
          <div className="flex items-stretch border-b-[3px] border-ink">
            <div className="flex w-[34%] items-center justify-center border-r-[3px] border-ink py-2">
              <span className={`font-sans text-5xl font-black leading-none ${letter ? "" : muted}`}>
                {letter || "?"}
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-center gap-0.5 px-2.5 py-2">
              <span className={`font-sans text-[11px] font-bold uppercase leading-tight ${rate ? "" : muted}`}>
                {rate ? `${rate.carrier} ${rate.service}` : "Pick a rate"}
              </span>
              {rate && <span className="text-[9px] text-ink/60">${rate.rate}</span>}
            </div>
          </div>

          {/* From + meta */}
          <div className="flex justify-between gap-2 px-3 pt-2.5">
            <div className="uppercase">
              {FROM_LINES.map((l) => (
                <div key={l}>{l}</div>
              ))}
            </div>
            <div className="text-right uppercase">
              <div className={weight ? "" : muted}>{weight || "0 OZ"}</div>
              <div className="text-ink/60">
                {toNum(form.length)}×{toNum(form.width)}×{toNum(form.height)} IN
              </div>
            </div>
          </div>

          {/* Ship to */}
          <div className="flex flex-1 flex-col justify-center px-3">
            <div className="mb-1 font-sans text-[9px] font-bold uppercase tracking-widest text-ink/50">Ship to</div>
            {hasAddress ? (
              <div className="pl-3 text-[12.5px] font-semibold uppercase leading-[1.35]">
                <div>{form.to_name || "—"}</div>
                {form.to_street1 && <div>{form.to_street1}</div>}
                {form.to_street2 && <div>{form.to_street2}</div>}
                {cityLine && <div>{cityLine}</div>}
              </div>
            ) : (
              <div className="space-y-1.5 pl-3">
                <div className="h-2.5 w-3/5 rounded bg-ink/10" />
                <div className="h-2.5 w-4/5 rounded bg-ink/10" />
                <div className="h-2.5 w-2/3 rounded bg-ink/10" />
              </div>
            )}
          </div>

          {/* Extras */}
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            {form.reference && (
              <span className="rounded border border-ink/30 px-1.5 py-0.5 uppercase">Ref {form.reference}</span>
            )}
            {signature && (
              <span className="rounded bg-ink px-1.5 py-0.5 font-sans font-bold uppercase text-white">
                Signature
              </span>
            )}
          </div>

          {/* Barcode placeholder */}
          <div className="border-t-[3px] border-ink px-3 pb-3 pt-2 text-center">
            <div className="font-sans text-[9px] font-bold uppercase tracking-widest">Tracking #</div>
            <div
              className="mx-auto mt-1.5 h-12 w-full opacity-15"
              style={{
                background:
                  "repeating-linear-gradient(90deg,#000 0 2px,transparent 2px 4px,#000 4px 5px,transparent 5px 8px,#000 8px 11px,transparent 11px 13px)",
              }}
            />
            <div className="mt-1 text-[9px] text-ink/50">Barcode added when you buy</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Envelope preview (#10, label printed on the envelope) ---------- */

function EnvelopePreview({ form, rate }: { form: typeof emptyForm; rate: Rate | null }) {
  const hasAddress = !!(form.to_name || form.to_street1);
  const cityLine = [form.to_city, [form.to_state, form.to_zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="relative aspect-[9.5/4.125] w-full overflow-hidden rounded-sm bg-[#fdfbf7] shadow-[0_1px_2px_rgba(0,0,0,.06),0_12px_30px_-8px_rgba(80,60,40,.25)] ring-1 ring-ink/10">
      <div className="flex h-full flex-col p-3 font-mono text-[9px] uppercase leading-snug text-ink">
        <div className="flex items-start justify-between gap-2">
          <div>
            {FROM_LINES.map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>
          <div className="flex h-11 w-16 flex-col items-center justify-center border border-ink/60 text-center text-[7px] leading-tight">
            <span className="font-sans font-bold">{rate ? "USPS" : "POSTAGE"}</span>
            <span>{rate ? `$${rate.rate}` : "AFTER RATE"}</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          {hasAddress ? (
            <div className="text-[11px] font-semibold leading-[1.35]">
              <div>{form.to_name}</div>
              {form.to_street1 && <div>{form.to_street1}</div>}
              {form.to_street2 && <div>{form.to_street2}</div>}
              {cityLine && <div>{cityLine}</div>}
            </div>
          ) : (
            <div className="w-1/2 space-y-1.5">
              <div className="h-2 w-3/5 rounded bg-ink/10" />
              <div className="h-2 w-4/5 rounded bg-ink/10" />
              <div className="h-2 w-2/3 rounded bg-ink/10" />
            </div>
          )}
        </div>
        <div className="flex items-end justify-between text-[8px] text-ink/50">
          <span>{form.reference ? `Ref ${form.reference}` : ""}</span>
          <span>First-Class letter · no tracking</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

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
  const [provider, setProvider] = useState<"easypost" | "shippo" | "shipstation" | "easyship" | "veeqo">("shippo");
  const [rates, setRates] = useState<Rate[]>([]);
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [oneClick, setOneClick] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [packageType, setPackageType] = useState<PackageType>("box");
  const ratesRef = useRef<HTMLElement>(null);
  const providerBeforeEnvelope = useRef<typeof provider>("shippo");

  // When rates arrive, glide down to them.
  useEffect(() => {
    if (!rates.length) return;
    requestAnimationFrame(() =>
      ratesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }, [rates]);

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
          length: data.length ?? MY_BOX.length,
          width: data.width ?? MY_BOX.width,
          height: data.height ?? MY_BOX.height,
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
        // A draft saved with envelope dimensions reopens as an envelope.
        if (
          Number(data.length) === ENVELOPE_10.length &&
          Number(data.width) === ENVELOPE_10.width
        ) {
          setPackageType("envelope");
        }
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

  function resetToMyBox() {
    setForm((f) => ({ ...f, ...MY_BOX }));
    setRates([]);
    setSelectedRate(null);
  }

  function choosePackage(type: PackageType) {
    setPackageType(type);
    // Letter postage is only set up through EasyPost; switching back to the box
    // restores whichever provider you had before.
    if (type === "envelope" && packageType !== "envelope") {
      providerBeforeEnvelope.current = provider;
      setProvider("easypost");
    } else if (type === "box" && packageType === "envelope") {
      setProvider(providerBeforeEnvelope.current);
    }
    setForm((f) => ({ ...f, ...(type === "envelope" ? ENVELOPE_10 : MY_BOX) }));
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
            // Tells /api/rates to ask the carrier for letter (envelope) rates.
            // EasyPost calls this predefined_package: "Letter".
            package_type: packageType,
            ...(packageType === "envelope" ? { predefined_package: "Letter" } : {}),
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
      // saveDraft throws the real Supabase error if it fails.
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

  const sortedRates = useMemo(() => [...rates].sort((a, b) => Number(a.rate) - Number(b.rate)), [rates]);
  const cheapestId = sortedRates[0]?.id;
  const fastestId = useMemo(() => {
    const withDays = sortedRates.filter((r) => r.delivery_days != null);
    return withDays.length
      ? withDays.reduce((min, r) =>
          (r.delivery_days as number) < (min.delivery_days as number) ? r : min
        ).id
      : null;
  }, [sortedRates]);

  // What the preview shows: the picked rate, otherwise the cheapest one.
  const previewRate = selectedRate ?? sortedRates[0] ?? null;

  const isEnvelope = packageType === "envelope";
  const isMyBox =
    toNum(form.length) === MY_BOX.length &&
    toNum(form.width) === MY_BOX.width &&
    toNum(form.height) === MY_BOX.height;
  const totalOz = toNum(form.weight_lb) * 16 + toNum(form.weight_oz);
  const envelopeTooHeavy = isEnvelope && totalOz > LETTER_MAX_OZ;

  const addressSummary = [
    form.to_street1,
    form.to_street2,
    [form.to_city, [form.to_state, form.to_zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Shell>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl">Create a label</h1>
        <button
          onClick={() => saveDraft().catch((e: any) => setError(e.message))}
          disabled={busy !== null}
          className="btn-secondary"
        >
          {busy === "draft" ? "Saving…" : orderId ? "Update draft" : "Save draft"}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------- Left: steps ---------- */}
        <div className="space-y-5">
          {/* 1. Ship to */}
          <section className="card !rounded-[2rem]">
            <SectionTitle n={1}>Ship To:</SectionTitle>

            {form.customer_id && form.to_name ? (
              <div className="mt-5 flex items-center gap-4 rounded-2xl border border-taupe/20 bg-cream/60 px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand/60 font-semibold text-taupe">
                  {form.to_name
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{form.to_name}</p>
                  <p className="truncate text-sm text-ink/60">{addressSummary || "No address on file"}</p>
                </div>
                <button
                  onClick={() => {
                    set("customer_id", null);
                    setSearch("");
                  }}
                  className="shrink-0 text-sm text-taupe underline underline-offset-2"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative mt-5">
                <input
                  className="input"
                  placeholder="Search existing customers by name, email or phone"
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
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">
                  Basket # <span className="text-ink/40">(optional)</span>
                </label>
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="e.g. 12"
                  value={form.basket_number}
                  onChange={(e) => set("basket_number", e.target.value.replace(/\D/g, ""))}
                />
                <p className="mt-1 text-xs text-ink/50">From this week&#39;s live — shows tracking on their portal.</p>
              </div>
              <div>
                <label className="label">
                  Reference # <span className="text-ink/40">(prints on label)</span>
                </label>
                <input
                  className="input"
                  placeholder="EB-000"
                  value={form.reference}
                  onChange={(e) => set("reference", e.target.value)}
                />
                <p className="mt-1 text-xs text-ink/50">Defaults to the order number.</p>
              </div>
            </div>

            {!manual ? (
              <button
                onClick={() => setManual(true)}
                className="mt-4 text-sm text-taupe underline underline-offset-2"
              >
                Enter address manually
              </button>
            ) : (
              <details className="group mt-4" open={!form.customer_id}>
                <summary className="cursor-pointer select-none text-sm text-taupe underline underline-offset-2">
                  {form.customer_id ? "Edit address details" : "Address details"}
                </summary>
                <div className="mt-4 grid gap-3">
                  <div>
                    <label className="label">Name</label>
                    <input className="input" value={form.to_name} onChange={(e) => set("to_name", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Street</label>
                    <AddressAutocomplete
                      value={form.to_street1}
                      placeholder="Start typing an address"
                      onChange={(v) => set("to_street1", v)}
                      onSelect={(a) => {
                        setForm((f) => ({
                          ...f,
                          to_street1: a.street1,
                          to_street2: a.street2 || f.to_street2,
                          to_city: a.city,
                          to_state: a.state,
                          to_zip: a.zip,
                        }));
                        setRates([]);
                        setSelectedRate(null);
                        setTimeout(function () { var el = document.getElementById("to_street2"); if (el) el.focus(); }, 0);
                      }}
                    />
                  </div>
                  <div>
                    <label className="label">Apt / Suite (optional)</label>
                    <input id="to_street2" className="input" value={form.to_street2} onChange={(e) => set("to_street2", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">City</label>
                      <input className="input" value={form.to_city} onChange={(e) => set("to_city", e.target.value)} />
                    </div>
                    <div>
                      <label className="label">State</label>
                      <input className="input" maxLength={2} value={form.to_state} onChange={(e) => set("to_state", e.target.value.toUpperCase())} />
                    </div>
                    <div>
                      <label className="label">ZIP</label>
                      <input className="input" inputMode="numeric" value={form.to_zip} onChange={(e) => set("to_zip", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Phone</label>
                      <input className="input" type="tel" value={form.to_phone} onChange={(e) => set("to_phone", e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input className="input" type="email" value={form.to_email} onChange={(e) => set("to_email", e.target.value)} />
                    </div>
                  </div>
                </div>
              </details>
            )}
          </section>

          {/* 2. Package */}
          <section className="card !rounded-[2rem]">
            <SectionTitle n={2}>Package</SectionTitle>

            {/* Package type */}
            <div className="mt-5 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Package type">
              {PACKAGES.map((p) => {
                const active = packageType === p.id;
                const label = p.id === "box" && active && !isMyBox ? "Custom box" : p.name;
                return (
                  <button
                    key={p.id}
                    role="radio"
                    aria-checked={active}
                    onClick={() => choosePackage(p.id)}
                    className={`rounded-2xl border-2 px-4 py-3.5 text-left transition-colors ${
                      active ? "border-taupe/70 bg-cream/70" : "border-taupe/15 bg-white hover:border-taupe/40"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{label}</span>
                      <span
                        className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                          active ? "border-taupe bg-taupe shadow-[inset_0_0_0_2px_#fff]" : "border-taupe/30"
                        }`}
                      />
                    </span>
                    <span className="mt-0.5 block text-sm text-ink/60">
                      {p.id === "box" && active && !isMyBox
                        ? `${toNum(form.length)} × ${toNum(form.width)} × ${toNum(form.height)} in`
                        : p.size}
                    </span>
                  </button>
                );
              })}
            </div>
            {packageType === "box" && !isMyBox && (
              <button onClick={resetToMyBox} className="mt-2 text-sm text-taupe underline underline-offset-2">
                Reset to my box (14 × 17 × 1)
              </button>
            )}

            <div className={`mt-5 grid gap-3 ${isEnvelope ? "grid-cols-2" : "grid-cols-3 sm:grid-cols-5"}`}>
              {!isEnvelope && (
                <>
                  <div>
                    <label className="label">Length</label>
                    <input type="number" className="input text-center" value={form.length} onChange={(e) => set("length", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label">Width</label>
                    <input type="number" className="input text-center" value={form.width} onChange={(e) => set("width", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label">Height</label>
                    <input type="number" className="input text-center" value={form.height} onChange={(e) => set("height", Number(e.target.value))} />
                  </div>
                </>
              )}
              <div>
                <label className="label">Pounds</label>
                <input type="number" min={0} className="input text-center" value={form.weight_lb} onChange={(e) => set("weight_lb", Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Ounces</label>
                <input type="number" min={0} step={0.1} className="input text-center" value={form.weight_oz} onChange={(e) => set("weight_oz", Number(e.target.value))} />
              </div>
            </div>

            {isEnvelope && (
              <p
                className={`mt-3 rounded-2xl px-4 py-3 text-sm ${
                  envelopeTooHeavy ? "bg-amber-50 text-amber-900" : "bg-cream/70 text-ink/70"
                }`}
              >
                {envelopeTooHeavy
                  ? `Over ${LETTER_MAX_OZ} oz — this won't get the letter rate. USPS prices it as a large envelope, or switch to your box.`
                  : `Letter rate covers up to ${LETTER_MAX_OZ} oz and ¼″ thick. Letters don't include tracking. Envelopes ship through EasyPost.`}
              </p>
            )}

            {/* Scale — fills pounds/ounces automatically */}
            <div className="mt-4">
              <ScaleReader
                onWeight={(totalOz) => {
                  const lb = Math.floor(totalOz / 16);
                  const oz = Math.round((totalOz - lb * 16) * 10) / 10;
                  setForm((f) => ({ ...f, weight_lb: String(oz >= 16 ? lb + 1 : lb), weight_oz: String(oz >= 16 ? 0 : oz) }));
                  setRates([]);
                  setSelectedRate(null);
                }}
              />
            </div>

            <button
              onClick={getRates}
              disabled={!canRate || busy !== null}
              className="btn-primary mt-6 w-full !py-3"
            >
              {busy === "rates" ? "Getting rates…" : rates.length ? "Refresh rates" : "Get rates"}
            </button>
            {!canRate && (
              <p className="mt-3 text-center text-xs text-ink/50">
                Enter a full address and a weight above 0.
              </p>
            )}
          </section>

          {/* 3. Shipping method */}
          <section ref={ratesRef} className="card scroll-mt-6 !rounded-[2rem]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <SectionTitle n={3}>Shipping Method</SectionTitle>
              {rates.length > 0 && (
                <span className="text-sm text-ink/50">
                  {oneClick ? "One-click is on — clicking a rate buys it" : "Pick a rate, then buy on the right"}
                </span>
              )}
            </div>

            {rates.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-taupe/25 px-6 py-10 text-center">
                <svg viewBox="0 0 64 48" className="mx-auto w-20 text-sand" aria-hidden>
                  <rect x="8" y="14" width="28" height="20" rx="2" fill="currentColor" opacity="0.5" />
                  <rect x="14" y="8" width="16" height="10" rx="2" fill="currentColor" />
                  <circle cx="16" cy="40" r="4" fill="currentColor" />
                  <path d="M44 34h12M44 28h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p className="mx-auto mt-3 max-w-xs text-sm text-ink/60">
                  Add the address and weight, then get rates to see your shipping options here.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {sortedRates.map((r) => {
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
                            ? "border-taupe bg-taupe/10 ring-1 ring-taupe/30"
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
                })}
              </div>
            )}
          </section>
        </div>

        {/* ---------- Right: preview + buy ---------- */}
        <aside className="space-y-5 xl:sticky xl:top-6">
          <section className="card !rounded-[2rem]">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-2xl">{isEnvelope ? "Envelope Preview" : "Label Preview"}</h2>
              <span className="text-xs text-ink/50">{isEnvelope ? "#10 Envelope" : "4 × 6"}</span>
            </div>
            <LabelPreview
              form={form}
              rate={previewRate}
              signature={form.signature_confirmation}
              envelope={isEnvelope}
            />
          </section>

          <section className="card space-y-4 !rounded-[2rem]">
            <div>
              <label className="label">Shipping provider</label>
              <select
                className="input"
                value={provider}
                onChange={(e) => { setProvider(e.target.value as any); setRates([]); setSelectedRate(null); }}
              >
                <option value="shippo">Shippo</option>
                <option value="easypost">EasyPost</option>
                <option value="easyship">EasyShip</option>
                <option value="shipstation">ShipStation</option>
                <option value="veeqo">Veeqo (Amazon Shipping, OnTrac)</option>
              </select>
            </div>

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-taupe"
                checked={form.signature_confirmation}
                onChange={(e) => set("signature_confirmation", e.target.checked)}
              />
              Require signature
            </label>

            <div>
              <label className="label">Order notes</label>
              <textarea
                className="input"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="h-px bg-taupe/15" />

            {/* One-click toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setOneClick(!oneClick)}
                aria-pressed={oneClick}
                aria-label="One-click purchase"
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${oneClick ? "bg-taupe" : "bg-sand/60"}`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${oneClick ? "left-6" : "left-1"}`}
                />
              </button>
              <div className="text-sm">
                <p className="font-medium">One-click purchase {oneClick ? "on" : "off"}</p>
                <p className="text-xs text-ink/50">
                  {oneClick ? "Clicking a rate buys the label right away." : "Pick a rate, then press Buy."}
                </p>
              </div>
            </div>

            {!oneClick && (
              <>
                <div className="flex items-baseline justify-between text-lg">
                  <span>Total</span>
                  <span className="font-heading text-2xl text-taupe">
                    {selectedRate ? `$${selectedRate.rate}` : "—"}
                  </span>
                </div>
                <button
                  onClick={() => selectedRate && buy(selectedRate)}
                  disabled={!selectedRate || busy !== null}
                  className="btn-primary w-full !py-3"
                >
                  {selectedRate
                    ? busy === selectedRate.id
                      ? "Buying…"
                      : `Buy ${selectedRate.carrier} ${selectedRate.service}`
                    : rates.length
                      ? "Select a rate"
                      : "Get rates first"}
                </button>
              </>
            )}

            <p className="text-xs leading-relaxed text-ink/50">
              Drafts can be continued later from the Orders page.
            </p>
          </section>
        </aside>
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