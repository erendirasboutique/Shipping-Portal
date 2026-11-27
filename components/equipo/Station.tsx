"use client";

// Frame for the team stations: back to Estaciones, title, the live sale
// picker. Phone first, big touch targets, Spanish.

import { useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { saleLabel, type ESale } from "@/components/equipo/useEquipo";

export default function Station({
  title,
  eyebrow,
  sale,
  sales,
  onSale,
  home = false,
  children,
}: {
  title: string;
  eyebrow?: string;
  sale?: ESale | null;
  sales?: ESale[];
  onSale?: (id: string) => void;
  home?: boolean;
  children: React.ReactNode;
}) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function openNew() {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
    setDate(today);
    setName("");
    setErr("");
    setAdding(true);
  }

  async function createLive() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/equipo/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sale_date: date, title: name }),
      });
      const json = await res.json();
      if (!res.ok || !json.sale) throw new Error(json.error || "No se pudo crear el live.");
      setAdding(false);
      if (onSale) onSale(json.sale.id);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <Shell>
      <div className="mx-auto max-w-xl">
        {!home && (
          <Link href="/equipo" className="mb-2 inline-flex min-h-[44px] items-center gap-1.5 text-[16px] text-ink/70">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            Estaciones
          </Link>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="mt-1 text-4xl md:text-5xl">{title}</h1>
          </div>
          {sales && onSale && (
            <label className="flex flex-col text-[13px] text-ink/60">
              <span className="sr-only">Live</span>
              <select
                className="input !w-auto !rounded-full !py-2 !text-[15px]"
                value={adding ? "__new" : sale?.id || ""}
                onChange={(e) => (e.target.value === "__new" ? openNew() : onSale(e.target.value))}
              >
                {!sales.length && <option value="">Sin lives</option>}
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>{saleLabel(s)}</option>
                ))}
                <option value="__new">+ Nuevo live</option>
              </select>
            </label>
          )}
        </div>

        {adding && (
          <section className="card mt-3 !p-5" aria-labelledby="new-live-t">
            <h2 id="new-live-t" className="text-2xl">Nuevo live</h2>
            <p className="mt-1 text-[14.5px] text-ink/60">Usa las mismas formas de pago y el mismo envío que el último live.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">Fecha</span>
                <input type="date" className="input !text-base" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Nombre (opcional)</span>
                <input className="input !text-base" placeholder="Ej. Live del martes" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
            </div>
            {err && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[14px] text-red-800">{err}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-primary !px-6 !py-3" disabled={busy} onClick={createLive}>{busy ? "Creando…" : "Crear live"}</button>
              <button type="button" className="btn-secondary !py-3" onClick={() => setAdding(false)}>Cancelar</button>
            </div>
          </section>
        )}
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </Shell>
  );
}
