"use client";

// A · Estaciones — the team's home. The week at a glance and one button per
// station, in the order of the week.

import Link from "next/link";
import Station from "@/components/equipo/Station";
import { useEquipo } from "@/components/equipo/useEquipo";

const ICON: Record<string, string> = {
  cam: "M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  pay: "M2 7h20v10H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  scan: "M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8",
  rows: "M4 6h16M4 12h16M4 18h10",
};

function Card({ href, day, title, sub, icon, stat, strong }: { href: string; day: string; title: string; sub: string; icon: string; stat?: string; strong?: boolean }) {
  return (
    <Link
      href={href}
      className={"flex items-center gap-4 rounded-3xl p-4 shadow-soft ring-1 ring-taupe/15 " + (strong ? "bg-taupe text-cream" : "bg-white text-ink dark:bg-transparent")}
    >
      <span className={"flex h-14 w-14 flex-none items-center justify-center rounded-2xl " + (strong ? "bg-white/20" : "bg-cream text-taupe dark:bg-transparent dark:ring-1 dark:ring-taupe/30")}>
        <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={"text-[12px] uppercase tracking-[0.14em] " + (strong ? "text-cream/80" : "text-ink/55")}>{day}</span>
        <span className="font-heading text-2xl leading-tight">{title}</span>
        <span className={"text-[14.5px] " + (strong ? "text-cream/85" : "text-ink/60")}>{sub}</span>
      </span>
      {stat && <span className={"text-right text-[14px] " + (strong ? "text-cream/90" : "text-ink/60")}>{stat}</span>}
    </Link>
  );
}

export default function EquipoHome() {
  const { data, error, setSale } = useEquipo();
  const c = data?.counts;

  return (
    <Station title="¿Qué toca hoy?" eyebrow="Equipo" home sale={data?.sale} sales={data?.sales} onSale={setSale}>
      {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      {data && !data.sale && (
        <div className="card !p-5 text-[15px] text-ink/70">Todavía no hay ningún live. Crea uno en las herramientas del live.</div>
      )}

      <section aria-label="La semana" className="card !p-5">
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ["canastas", c?.total, ""],
            ["pagadas", c?.paid, "text-taupe"],
            ["por confirmar", c?.to_confirm, ""],
            ["sin pagar", c?.unpaid, "text-red-800"],
          ].map(([label, n, cls]) => (
            <div key={label as string} className="flex flex-col gap-0.5">
              <span className={"font-heading text-3xl " + cls}>{n ?? "–"}</span>
              <span className="text-[12.5px] text-ink/60">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <nav aria-label="Estaciones" className="flex flex-col gap-3">
        <Card href="/equipo/canasta" day="Mar · Mié · Jue noche" title="Fotos y totales" sub="Foto, total, mandar e imprimir calcomanía" icon={ICON.cam} stat={c ? `${c.sent} de ${c.total}\nenviadas` : undefined} />
        <Card href="/pagos" day="Viernes" title="Pagos" sub="Confirmar Zelle, Venmo, Cash App, PayPal" icon={ICON.pay} stat={data ? `${data.pagos_new} nuevos` : undefined} strong={!!data?.pagos_new} />
        <Card href="/equipo/escanear" day="Sábado" title="¿Ya pagó?" sub="Escanear la calcomanía y crear la etiqueta" icon={ICON.scan} />
        <Card href="/equipo/filas" day="Toda la semana" title="Filas A–Z" sub="Quién falta por letra" icon={ICON.rows} />
      </nav>
    </Station>
  );
}
