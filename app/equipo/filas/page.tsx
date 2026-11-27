"use client";

// E · Filas A–Z — the bags on the floor, by first letter. Each line shows
// how many are paid; tap a letter to see who's missing and remind them.

import { useMemo, useState } from "react";
import Link from "next/link";
import Station from "@/components/equipo/Station";
import { money, useEquipo, type EBasket } from "@/components/equipo/useEquipo";
import { shareNow } from "@/components/equipo/share";
import { reminderMessage } from "@/lib/live/messages";

export default function FilasPage() {
  const { data, error, setSale } = useEquipo();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const lines = useMemo(() => {
    const map = new Map<string, EBasket[]>();
    (data?.baskets || [])
      .filter((b) => b.sent)
      .forEach((b) => {
        const list = map.get(b.letter) || [];
        list.push(b);
        map.set(b.letter, list);
      });
    return Array.from(map.entries())
      .map(([letter, list]) => ({
        letter,
        list: list.sort((a, b) => a.number - b.number),
        paid: list.filter((b) => b.paid && !b.to_confirm).length,
      }))
      .sort((a, b) => a.letter.localeCompare(b.letter));
  }, [data]);

  const missing = open ? lines.find((l) => l.letter === open)?.list.filter((b) => !(b.paid && !b.to_confirm)) || [] : [];

  function remind(b: EBasket) {
    if (!b.customer?.token) return setNote("Esta clienta no tiene enlace todavía.");
    const text = reminderMessage({ locale: "es", customerName: b.customer.name, basketNumber: b.number, totalCents: b.total_cents, portalToken: b.customer.token });
    shareNow(null, text).then((r) => setNote(r === "copied" ? `Recordatorio para ${b.customer?.name} copiado. Pégalo en su chat.` : ""));
  }

  return (
    <Station title="Filas A–Z" eyebrow="Toda la semana" sale={data?.sale} sales={data?.sales} onSale={setSale}>
      {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <p className="px-1 text-[15px] text-ink/70">Pagadas en cada fila del piso. Borde = fila lista para etiquetas.</p>

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {lines.map((l) => {
          const all = l.paid === l.list.length;
          return (
            <button
              key={l.letter}
              type="button"
              aria-pressed={open === l.letter}
              onClick={() => setOpen(open === l.letter ? null : l.letter)}
              className={"flex flex-col items-center gap-1.5 rounded-3xl bg-white px-2 py-3 ring-2 dark:bg-transparent " + (open === l.letter ? "ring-ink" : all ? "ring-taupe" : "ring-transparent")}
            >
              <span className="font-heading text-4xl leading-none">{l.letter}</span>
              <span className="text-[14px] text-ink/60">{l.paid} de {l.list.length}</span>
              <span className="h-2 w-full overflow-hidden rounded-full bg-cream dark:bg-taupe/20">
                <span className="block h-full rounded-full bg-taupe" style={{ width: Math.round((l.paid / l.list.length) * 100) + "%" }} />
              </span>
            </button>
          );
        })}
        {data && !lines.length && <p className="col-span-full text-[15px] text-ink/60">Todavía no se manda ninguna canasta en este live.</p>}
      </div>

      {open && (
        <section className="card !p-5" aria-labelledby="miss-t">
          <h2 id="miss-t" className="text-2xl">{missing.length ? `Faltan en la fila ${open}` : `Fila ${open} lista`}</h2>
          {note && <p role="status" className="mt-2 rounded-xl bg-cream px-3 py-2 text-[14.5px] dark:bg-transparent">{note}</p>}
          <ul className="mt-2 divide-y divide-taupe/15">
            {missing.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-3">
                <span className="flex-1 text-[16px]"><span className="font-heading text-xl text-taupe">#{b.number}</span> {b.customer?.name || "Sin clienta"}</span>
                {b.to_confirm ? (
                  <Link href={"/equipo/escanear?b=" + b.id} className="text-[14.5px] text-ink/70 underline">Por confirmar</Link>
                ) : (
                  <>
                    <span className="text-[14px] text-red-800">{money(b.total_cents)}</span>
                    <button type="button" className="btn-secondary !px-3 !py-2" onClick={() => remind(b)}>Recordar</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Station>
  );
}
