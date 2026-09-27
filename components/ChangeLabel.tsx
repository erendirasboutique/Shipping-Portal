"use client";

// Change & rebuy: new weight/box/insurance and any service, bought as a
// replacement label. The server buys the new label first, then voids the
// old one, so the order is never left without a working label.

import { useState } from "react";

type Rate = { id: string; carrier: string; service: string; rate: string; delivery_days: number | null };

const REASONS = ["Faster service", "Weight was wrong", "Box size changed", "Add insurance", "Other"];

function num(v: any) {
  return v == null ? "" : String(v);
}

export default function ChangeLabel({
  order,
  onDone,
  onCancel,
}: {
  order: any;
  onDone: (updated: any, oldRefund: string) => void;
  onCancel: () => void;
}) {
  const [weightLb, setWeightLb] = useState(num(order.weight_lb));
  const [weightOz, setWeightOz] = useState(num(order.weight_oz));
  const [length, setLength] = useState(num(order.length));
  const [width, setWidth] = useState(num(order.width));
  const [height, setHeight] = useState(num(order.height));
  const [insure, setInsure] = useState(!!order.insurance_amount);
  const [insureAmt, setInsureAmt] = useState(num(order.insurance_amount || ""));
  const [reason, setReason] = useState("");
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [shipmentRef, setShipmentRef] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function body(extra: any) {
    return {
      orderId: order.id,
      parcel: { weight_lb: weightLb, weight_oz: weightOz, length, width, height },
      insurance: insure ? insureAmt : null,
      ...extra,
    };
  }

  function changed() {
    setRates(null);
    setShipmentRef(null);
  }

  async function getRates() {
    setErr(null);
    if (insure && !(Number(insureAmt) > 0)) {
      setErr("Enter how much to insure it for.");
      return;
    }
    setBusy("rates");
    try {
      const res = await fetch("/api/label-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body({ action: "rates" })),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't get rates.");
      setRates(d.rates || []);
      setShipmentRef(d.shipmentRef);
      if (!(d.rates || []).length) setErr("No rates came back. Check the weight and box size.");
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(null);
  }

  async function buy(rate: Rate) {
    const oldCost = order.postage_amount != null ? " (old label $" + Number(order.postage_amount).toFixed(2) + " gets voided)" : "";
    if (!confirm("Buy " + rate.carrier + " " + rate.service + " for $" + Number(rate.rate).toFixed(2) + " and void the old label?" + oldCost)) return;
    setBusy(rate.id);
    setErr(null);
    try {
      const res = await fetch("/api/label-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body({ action: "rebuy", shipmentRef, rateId: rate.id, reason: reason || null })),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't buy the new label.");
      onDone(d.order, d.oldRefund);
    } catch (e: any) {
      setErr(e.message);
      setBusy(null);
    }
  }

  const currentService = [order.carrier, order.mail_class].filter(Boolean).join(" ");

  return (
    <div className="mt-5 rounded-3xl border border-taupe/25 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Change &amp; rebuy</p>
        <button onClick={onCancel} disabled={!!busy} className="text-xs text-taupe underline underline-offset-2">Cancel</button>
      </div>
      <p className="mt-0.5 text-xs text-ink/60">
        Now: {currentService || "label"}
        {order.postage_amount != null ? " · $" + Number(order.postage_amount).toFixed(2) : ""}
        {order.insurance_amount ? " · insured $" + Number(order.insurance_amount).toFixed(0) : ""}
      </p>

      <p className="label mt-4">Why?</p>
      <div className="flex flex-wrap gap-1.5">
        {REASONS.map((r) => (
          <button
            key={r}
            onClick={() => {
              setReason(r);
              if (r === "Add insurance") {
                setInsure(true);
                changed();
              }
            }}
            className={`rounded-full border px-3 py-1 text-xs ${
              reason === r ? "border-taupe bg-taupe text-cream dark:text-[#26211b]" : "border-taupe/30 text-taupe hover:bg-taupe/10"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <p className="label mt-4">Weight</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input type="number" min={0} className="input !px-2 text-center" value={weightLb} onChange={(e) => { setWeightLb(e.target.value); changed(); }} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/50">lbs</span>
        </div>
        <div className="relative flex-1">
          <input type="number" min={0} step={0.1} className="input !px-2 text-center" value={weightOz} onChange={(e) => { setWeightOz(e.target.value); changed(); }} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/50">oz</span>
        </div>
      </div>

      <p className="label mt-3">Box (inches)</p>
      <div className="flex gap-2">
        <input type="number" className="input !px-2 text-center" value={length} onChange={(e) => { setLength(e.target.value); changed(); }} aria-label="Length" />
        <input type="number" className="input !px-2 text-center" value={width} onChange={(e) => { setWidth(e.target.value); changed(); }} aria-label="Width" />
        <input type="number" className="input !px-2 text-center" value={height} onChange={(e) => { setHeight(e.target.value); changed(); }} aria-label="Height" />
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={insure} onChange={(e) => { setInsure(e.target.checked); changed(); }} />
        Insure this package
      </label>
      {insure && (
        <div className="relative mt-2">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink/50">$</span>
          <input
            type="number"
            min={0}
            step={1}
            className="input !pl-7"
            placeholder="Value of what's inside, e.g. 120"
            value={insureAmt}
            onChange={(e) => { setInsureAmt(e.target.value); changed(); }}
          />
          <p className="mt-1 text-[11px] text-ink/50">The insurance cost is added to the new label&apos;s price when you buy it.</p>
        </div>
      )}

      {!rates && (
        <button onClick={getRates} disabled={!!busy} className="btn-primary mt-4 w-full">
          {busy === "rates" ? "Getting rates…" : "Get new rates"}
        </button>
      )}

      {rates && rates.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="label">Pick the new label</p>
          {rates.map((r) => {
            const same = currentService && (r.carrier + " " + r.service).toLowerCase() === currentService.toLowerCase();
            return (
              <button
                key={r.id}
                onClick={() => buy(r)}
                disabled={!!busy}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition hover:border-taupe disabled:opacity-50 ${
                  same ? "border-taupe/60 bg-cream/60 dark:bg-transparent" : "border-taupe/20"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {r.carrier} · {r.service}
                    {same ? <span className="ml-1.5 text-xs font-normal text-taupe">(same as now)</span> : null}
                  </span>
                  {r.delivery_days != null && (
                    <span className="block text-xs text-ink/60">~{r.delivery_days} day{r.delivery_days === 1 ? "" : "s"}</span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-taupe">{busy === r.id ? "Buying…" : "$" + Number(r.rate).toFixed(2)}</span>
              </button>
            );
          })}
          <p className="text-[11px] text-ink/50">
            The new label is bought first. Only then is the old one voided and refunded, and the order keeps its EB number.
          </p>
        </div>
      )}

      {err && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{err}</p>}
    </div>
  );
}
