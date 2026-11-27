"use client";

// Todas las canastas — every basket of the live at a glance: photo, number,
// name, total and where it is (not sent, waiting for payment, to confirm,
// paid, label made, shipped). Filter, search, tap one for its actions.
// Wide on a laptop, two across on a phone.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Station from "@/components/equipo/Station";
import { money, useEquipo, type EBasket } from "@/components/equipo/useEquipo";
import { shareNow } from "@/components/equipo/share";
import { portalUrl, reminderMessage } from "@/lib/live/messages";

type Stage = "sin_mandar" | "sin_pagar" | "por_confirmar" | "pagada" | "etiqueta" | "enviada";

const STAGES: { key: Stage; label: string; chip: string; dot: string }[] = [
  { key: "sin_mandar", label: "Sin mandar", chip: "bg-cream text-ink/70 dark:bg-taupe/20", dot: "bg-ink/30" },
  { key: "sin_pagar", label: "Sin pagar", chip: "bg-[#f8e9e4] text-[#8a2c1c] dark:bg-red-900/30 dark:text-red-200", dot: "bg-[#c96f4a]" },
  { key: "por_confirmar", label: "Por confirmar", chip: "bg-[#fbf0d9] text-[#7a5410] dark:bg-amber-900/30 dark:text-amber-200", dot: "bg-[#d9a13b]" },
  { key: "pagada", label: "Pagada", chip: "bg-[#e6eee4] text-[#355033] dark:bg-green-900/30 dark:text-green-200", dot: "bg-[#4a6547]" },
  { key: "etiqueta", label: "Etiqueta lista", chip: "bg-[#e6eee4] text-[#355033] dark:bg-green-900/30 dark:text-green-200", dot: "bg-[#4a6547]" },
  { key: "enviada", label: "Enviada", chip: "bg-taupe/15 text-ink dark:bg-taupe/25", dot: "bg-taupe" },
];

function stageOf(b: EBasket): Stage {
  if (b.status === "shipped") return "enviada";
  if (b.to_confirm) return "por_confirmar";
  if (b.paid) return b.order_id ? "etiqueta" : "pagada";
  if (b.status === "finalized") return "sin_pagar";
  return "sin_mandar";
}

const stageInfo = (s: Stage) => STAGES.find((x) => x.key === s) || STAGES[0];

function fold(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

type Sort = "numero" | "nombre" | "total";

export default function CanastasPage() {
  const { data, error, reload, setSale } = useEquipo();
  const [filter, setFilter] = useState<Stage | "todas">("todas");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("numero");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // Keep it live while it's on screen: payments come in all Friday.
  useEffect(() => {
    let timer: number | undefined;
    function start() {
      stop();
      timer = window.setInterval(reload, 30000);
    }
    function stop() {
      if (timer) window.clearInterval(timer);
      timer = undefined;
    }
    function onVis() {
      if (document.visibilityState === "visible") {
        reload();
        start();
      } else stop();
    }
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reload]);

  const all = useMemo(() => (data?.baskets || []).filter((b) => b.customer || b.sent || b.photo_url), [data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todas: all.length };
    STAGES.forEach((s) => (c[s.key] = 0));
    all.forEach((b) => (c[stageOf(b)] += 1));
    return c;
  }, [all]);

  const sums = useMemo(() => {
    let sold = 0;
    let collected = 0;
    let owed = 0;
    let pending = 0;
    all.forEach((b) => {
      const st = stageOf(b);
      if (st === "sin_mandar") return;
      sold += b.total_cents;
      if (st === "sin_pagar") owed += b.total_cents;
      else if (st === "por_confirmar") pending += b.total_cents;
      else collected += b.total_cents;
    });
    return { sold, collected, owed, pending };
  }, [all]);

  const shown = useMemo(() => {
    const needle = fold(q.trim()).replace(/^#/, "");
    const list = all.filter((b) => {
      if (filter !== "todas" && stageOf(b) !== filter) return false;
      if (!needle) return true;
      return String(b.number) === needle || fold(b.customer?.name || "").indexOf(needle) >= 0;
    });
    return list.sort((a, b) => {
      if (sort === "nombre") return (a.customer?.name || "~").localeCompare(b.customer?.name || "~", "es") || a.number - b.number;
      if (sort === "total") return b.total_cents - a.total_cents || a.number - b.number;
      return a.number - b.number;
    });
  }, [all, filter, q, sort]);

  const open = openId ? all.find((b) => b.id === openId) || null : null;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function remind(b: EBasket) {
    if (!b.customer?.token) return setNote("Esta clienta no tiene enlace todavía.");
    const text = reminderMessage({ locale: "es", customerName: b.customer.name, basketNumber: b.number, totalCents: b.total_cents, portalToken: b.customer.token });
    shareNow(null, text).then((r) => setNote(r === "copied" ? `Recordatorio para ${b.customer?.name} copiado. Pégalo en su chat.` : ""));
  }

  const saleQ = data?.sale ? "&sale=" + encodeURIComponent(data.sale.id) : "";

  return (
    <Station title="Todas las canastas" eyebrow="De un vistazo" sale={data?.sale} sales={data?.sales} onSale={setSale} wide>
      {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      {/* The week's money */}
      <section className="card !p-4 sm:!p-5" aria-label="Resumen">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Vendido", sums.sold, `${all.length - counts.sin_mandar} mandadas`],
            ["Cobrado", sums.collected, `${counts.pagada + counts.etiqueta + counts.enviada} pagadas`],
            ["Por confirmar", sums.pending, `${counts.por_confirmar} capturas`],
            ["Por cobrar", sums.owed, `${counts.sin_pagar} sin pagar`],
          ].map(([label, cents, sub]) => (
            <div key={label as string} className="flex flex-col gap-0.5">
              <span className="text-[13px] text-ink/60">{label}</span>
              <span className="font-heading text-3xl leading-none">{data ? money(cents as number) : "–"}</span>
              <span className="text-[13px] text-ink/60">{data ? sub : ""}</span>
            </div>
          ))}
        </div>
        {sums.sold > 0 && (
          <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-cream dark:bg-taupe/20" aria-hidden="true">
            <span className="block h-full bg-[#4a6547]" style={{ width: (sums.collected / sums.sold) * 100 + "%" }} />
            <span className="block h-full bg-[#d9a13b]" style={{ width: (sums.pending / sums.sold) * 100 + "%" }} />
          </div>
        )}
      </section>

      {/* Filters + search */}
      <div className="flex flex-col gap-3">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filtrar">
          {[{ key: "todas" as const, label: "Todas" }, ...STAGES].map((s) => {
            const on = filter === s.key;
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(s.key)}
                className={"shrink-0 rounded-full px-3.5 py-2 text-[14.5px] ring-1 " + (on ? "bg-ink text-white ring-ink dark:bg-white dark:text-ink" : "bg-white ring-taupe/25 dark:bg-transparent")}
              >
                {s.label} <span className={on ? "opacity-80" : "text-ink/50"}>{counts[s.key] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nombre o #"
            aria-label="Buscar nombre o número"
            className="input min-w-0 flex-1"
          />
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar" className="input w-auto">
            <option value="numero">Por número</option>
            <option value="nombre">Por nombre</option>
            <option value="total">Por total</option>
          </select>
        </div>
      </div>

      {note && (
        <p role="status" className="rounded-xl bg-cream px-3 py-2 text-[14.5px] dark:bg-transparent">
          {note}
        </p>
      )}

      {/* The board */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {shown.map((b) => {
          const st = stageInfo(stageOf(b));
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setNote("");
                setOpenId(b.id);
              }}
              className="group flex flex-col overflow-hidden rounded-3xl bg-white text-left ring-1 ring-taupe/15 transition hover:ring-taupe/50 dark:bg-transparent"
            >
              <span className="relative block aspect-square w-full bg-gradient-to-br from-[#e4d6c6] to-[#e8c3a8]">
                {b.photo_url && <img src={b.photo_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
                <span className="absolute left-2 top-2 rounded-xl bg-white px-2 py-0.5 font-heading text-lg text-ink">#{b.number}</span>
                {b.customer && <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 font-heading text-lg text-ink">{b.letter}</span>}
              </span>
              <span className="flex flex-col gap-1.5 p-3">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15.5px]">{b.customer?.name || "Sin clienta"}</span>
                  <span className="shrink-0 font-heading text-lg">{b.total_cents ? money(b.total_cents) : ""}</span>
                </span>
                <span className={"inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[12.5px] " + st.chip}>
                  <span className={"h-1.5 w-1.5 rounded-full " + st.dot} aria-hidden="true" />
                  {st.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {data && !shown.length && (
        <p className="px-1 text-[15px] text-ink/60">{all.length ? "Ninguna canasta con ese filtro." : "Todavía no hay canastas en este live."}</p>
      )}
      {!data && !error && <p className="px-1 text-[15px] text-ink/60">Cargando…</p>}

      {/* One basket's actions */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpenId(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cn-t"
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:bg-[#2a241e] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#e4d6c6] to-[#e8c3a8]">
              {open.photo_url ? <img src={open.photo_url} alt={"Foto de la canasta #" + open.number} className="max-h-[45vh] w-full object-cover" /> : <div className="h-40" />}
              <button type="button" aria-label="Cerrar" onClick={() => setOpenId(null)} className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl text-ink">
                ×
              </button>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <h2 id="cn-t" className="text-2xl">
                <span className="text-taupe">#{open.number}</span> {open.customer?.name || "Sin clienta"}
              </h2>
              <span className="font-heading text-3xl">{open.total_cents ? money(open.total_cents) : "—"}</span>
            </div>
            {(() => {
              const st = stageInfo(stageOf(open));
              return (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-ink/70">
                  <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] " + st.chip}>
                    <span className={"h-1.5 w-1.5 rounded-full " + st.dot} aria-hidden="true" />
                    {st.label}
                  </span>
                  {open.customer && <span>Fila {open.letter}</span>}
                  {open.payment_method && <span>· {open.payment_method.replace(/_/g, " ")}</span>}
                </p>
              );
            })()}
            {note && <p role="status" className="mt-3 rounded-xl bg-cream px-3 py-2 text-[14.5px] dark:bg-transparent">{note}</p>}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href={`/equipo/canasta?n=${open.number}${saleQ}`} className="btn-secondary justify-center text-center">
                Foto y total
              </Link>
              <Link href={`/equipo/calcomania/${open.id}`} className="btn-secondary justify-center text-center">
                Calcomanía
              </Link>
              {open.customer?.token && (
                <a href={portalUrl(open.customer.token)} target="_blank" rel="noreferrer" className="btn-secondary justify-center text-center">
                  Su página
                </a>
              )}
              {open.messenger?.openUrl && (
                <a href={open.messenger.openUrl} target="_blank" rel="noreferrer" className="btn-secondary justify-center text-center">
                  Messenger
                </a>
              )}
              {stageOf(open) === "sin_pagar" && (
                <button type="button" className="btn-secondary justify-center" onClick={() => remind(open)}>
                  Recordar pago
                </button>
              )}
              {stageOf(open) === "por_confirmar" && (
                <Link href={`/equipo/escanear?b=${open.id}`} className="btn-primary justify-center text-center">
                  Revisar captura
                </Link>
              )}
              {stageOf(open) === "pagada" && (
                <Link href={`/equipo/escanear?b=${open.id}`} className="btn-primary justify-center text-center">
                  Crear etiqueta
                </Link>
              )}
              {open.order_id && (
                <Link href={`/orders/${open.order_id}`} className="btn-secondary justify-center text-center">
                  Ver etiqueta
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </Station>
  );
}
