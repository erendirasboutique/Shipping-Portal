"use client";

// Pagos — Friday. Venmo, PayPal, Cash App and Zelle emails are forwarded to
// Resend and read by /api/webhooks/resend-inbound. Each payment shows here
// with the basket it most likely belongs to; a person taps Confirmar and the
// basket is marked paid (Saturday's order is created, same as "mark paid" in
// the live tools). Cash and anything without an email: "Efectivo u otro".

import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { getOperator } from "@/lib/live/operator";

type Suggestion = {
  id: string;
  basket_number: number;
  total_cents: number;
  customer_name: string | null;
  sale_title: string | null;
  sale_date: string | null;
  score: number;
  why: string[];
};

type OpenBasket = Omit<Suggestion, "score" | "why"> & { status: string };

type Payment = {
  id: string;
  created_at: string;
  source: "venmo" | "paypal" | "cashapp" | "zelle" | "gmail_confirm";
  auth_status: "pass" | "unknown" | "fail";
  forwarded_by: string | null;
  payer_name: string | null;
  amount_cents: number | null;
  note: string | null;
  reference: string | null;
  paid_on: string | null;
  status: "new" | "confirmed" | "ignored";
  basket_number: number | null;
  confirmed_by: string | null;
  suggestions: Suggestion[];
};

const SOURCE: Record<string, string> = {
  venmo: "Venmo",
  paypal: "PayPal",
  cashapp: "Cash App",
  zelle: "Zelle",
  gmail_confirm: "Gmail",
};

const MANUAL_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "applepay", label: "Apple Pay" },
  { value: "zelle", label: "Zelle" },
  { value: "cashapp", label: "Cash App" },
  { value: "venmo", label: "Venmo" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "Otro" },
];

function money(c: number | null | undefined) {
  if (c == null) return "—";
  return "$" + (c / 100).toFixed(2).replace(/\.00$/, "");
}

function when(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-MX", { weekday: "short", hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** One clear answer when the best match is far ahead of the rest. */
function sureOne(s: Suggestion[]): Suggestion | null {
  if (!s.length) return null;
  const [a, b] = s;
  if (a.score >= 100) return a;
  if (a.score >= 75 && (!b || a.score - b.score >= 25)) return a;
  return null;
}

export default function PagosPage() {
  const [tab, setTab] = useState<"new" | "done">("new");
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [open, setOpen] = useState<OpenBasket[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<{ text: string; warn?: boolean } | null>(null);
  const [busy, setBusy] = useState("");
  const [searchFor, setSearchFor] = useState<string | null>(null); // payment id, or "manual"
  const [query, setQuery] = useState("");
  const [manualBasket, setManualBasket] = useState<OpenBasket | null>(null);
  const [manualMethod, setManualMethod] = useState("cash");
  const [manualNote, setManualNote] = useState("");

  const load = useCallback(async (which: "new" | "done") => {
    setErr("");
    try {
      const res = await fetch("/api/pagos?tab=" + which, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar.");
      setPayments(data.payments);
      setOpen(data.open_baskets || []);
      setNewCount(data.new_count || 0);
    } catch (e: any) {
      setErr(e.message);
      setPayments([]);
    }
  }, []);

  useEffect(() => {
    setPayments(null);
    load(tab);
  }, [tab, load]);

  // New emails arrive during the morning; refresh every minute while open.
  useEffect(() => {
    if (tab !== "new") return;
    const id = window.setInterval(() => load("new"), 60000);
    return () => window.clearInterval(id);
  }, [tab, load]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), toast.warn ? 9000 : 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    if (!q) return open.slice(0, 12);
    return open
      .filter((b) => String(b.basket_number) === q || (b.customer_name || "").toLowerCase().includes(q) || money(b.total_cents) === "$" + q)
      .slice(0, 12);
  }, [open, query]);

  async function act(p: Payment, action: "confirm" | "ignore" | "restore", basket?: { id: string; basket_number: number }) {
    setBusy(p.id);
    try {
      const res = await fetch("/api/pagos/" + p.id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, basket_id: basket?.id, by: getOperator() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      if (action === "confirm") {
        const extra = [data.mismatch, data.warning].filter(Boolean).join(" ");
        setToast({ text: `Canasta #${data.basket_number} pagada con ${SOURCE[p.source]}.${extra ? " " + extra : ""}`, warn: !!extra });
      } else {
        setToast({ text: action === "ignore" ? "Listo, lo quitamos de la lista." : "Regresó a Nuevos." });
      }
      setSearchFor(null);
      setQuery("");
      await load(tab);
    } catch (e: any) {
      setToast({ text: e.message, warn: true });
    }
    setBusy("");
  }

  async function markManual() {
    if (!manualBasket) return;
    setBusy("manual");
    try {
      const res = await fetch("/api/live/baskets/" + manualBasket.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paid",
          payment_method: manualMethod,
          payment_note: manualNote.trim() || null,
          by: getOperator() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setToast({ text: `Canasta #${manualBasket.basket_number} pagada (${MANUAL_METHODS.find((m) => m.value === manualMethod)?.label}).`, warn: !!data.warning });
      setManualBasket(null);
      setManualNote("");
      setSearchFor(null);
      setQuery("");
      await load(tab);
    } catch (e: any) {
      setToast({ text: e.message, warn: true });
    }
    setBusy("");
  }

  const searchBox = (forId: string) =>
    searchFor === forId ? (
      <div className="mt-3 rounded-2xl bg-cream/70 p-3 dark:bg-transparent dark:ring-1 dark:ring-taupe/20">
        <label className="label" htmlFor={"q-" + forId}>Número, nombre o total</label>
        <input
          id={"q-" + forId}
          className="input !text-base"
          placeholder="Ej. 23, Ana o 100"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <ul className="mt-2 max-h-72 space-y-1.5 overflow-auto">
          {results.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => {
                  if (forId === "manual") setManualBasket(b);
                  else {
                    const p = (payments || []).find((x) => x.id === forId);
                    if (p) act(p, "confirm", b);
                  }
                }}
                className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl bg-white px-3 text-left text-[15px] ring-1 ring-taupe/20 hover:ring-taupe/50 dark:bg-transparent"
              >
                <span><span className="font-heading text-lg text-taupe">#{b.basket_number}</span> {b.customer_name || "Sin nombre"}</span>
                <span className="text-ink/70">{money(b.total_cents)}</span>
              </button>
            </li>
          ))}
          {!results.length && <li className="px-1 py-2 text-sm text-ink/60">No hay canastas sin pagar que coincidan.</li>}
        </ul>
      </div>
    ) : null;

  return (
    <Shell>
      <div className="card !rounded-[2rem] !p-6 md:!p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Viernes</p>
            <h1 className="mt-1 text-5xl">Pagos</h1>
            <p className="mt-2 max-w-xl text-[15px] text-ink/70">
              Leemos los correos de Venmo, PayPal, Cash App y Zelle. Tú solo confirmas a qué canasta va cada pago.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary !px-5 !py-3"
            onClick={() => {
              setSearchFor(searchFor === "manual" ? null : "manual");
              setManualBasket(null);
              setQuery("");
            }}
          >
            Efectivo u otro pago
          </button>
        </div>

        {searchFor === "manual" && (
          <div className="mt-5 rounded-3xl border border-taupe/20 p-4">
            <p className="font-heading text-2xl text-taupe">Marcar pagado a mano</p>
            {!manualBasket ? (
              searchBox("manual")
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-[15px]">
                  <span className="font-heading text-xl text-taupe">#{manualBasket.basket_number}</span> {manualBasket.customer_name || "Sin nombre"} · {money(manualBasket.total_cents)}{" "}
                  <button type="button" className="ml-2 underline" onClick={() => setManualBasket(null)}>Cambiar</button>
                </p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cómo pagó">
                  {MANUAL_METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      role="radio"
                      aria-checked={manualMethod === m.value}
                      onClick={() => setManualMethod(m.value)}
                      className={"min-h-[44px] rounded-full px-4 text-sm ring-1 " + (manualMethod === m.value ? "bg-taupe text-cream ring-taupe" : "bg-white text-ink ring-taupe/30 dark:bg-transparent")}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <label className="label" htmlFor="manual-note">Nota (opcional)</label>
                <input id="manual-note" className="input" placeholder="Ej. pagó en la tienda" value={manualNote} onChange={(e) => setManualNote(e.target.value)} />
                <button type="button" className="btn-primary !px-6 !py-3" disabled={busy === "manual"} onClick={markManual}>
                  {busy === "manual" ? "Guardando…" : "Marcar pagada"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 inline-flex rounded-full bg-cream p-1 ring-1 ring-taupe/20 dark:bg-transparent" role="tablist" aria-label="Pagos">
          {(["new", "done"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={"min-h-[40px] rounded-full px-5 text-sm " + (tab === t ? "bg-white text-ink shadow-soft dark:bg-taupe dark:text-[#26211b]" : "text-ink/60")}
            >
              {t === "new" ? `Nuevos${newCount ? " · " + newCount : ""}` : "Revisados"}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div role="status" className={"fixed inset-x-3 bottom-4 z-50 mx-auto max-w-md rounded-2xl px-4 py-3 text-[15px] shadow-soft " + (toast.warn ? "bg-amber-50 text-amber-900 ring-1 ring-amber-300" : "bg-ink text-cream")}>
          {toast.text}
        </div>
      )}

      {err && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>}

      <div className="mt-5 space-y-4">
        {payments === null && <div className="card animate-pulse !p-6 text-ink/50">Cargando…</div>}

        {payments && !payments.length && !err && (
          <div className="card !p-6 text-[15px] text-ink/70">
            {tab === "new"
              ? "No hay pagos nuevos. Cuando llegue un correo de Venmo, PayPal, Cash App o Zelle, aparece aquí."
              : "Todavía no hay pagos revisados."}
          </div>
        )}

        {payments?.map((p) => {
          if (p.source === "gmail_confirm") {
            return (
              <article key={p.id} className="card !p-5">
                <p className="eyebrow">Gmail · reenvío</p>
                <p className="mt-1 text-[15px]">Gmail mandó el código para confirmar el reenvío automático:</p>
                <p className="mt-2 font-heading text-4xl tracking-wider text-taupe">{(p.note || "").replace(/^Código:\s*/, "") || "—"}</p>
                {p.status === "new" && (
                  <button type="button" className="btn-secondary mt-3" disabled={busy === p.id} onClick={() => act(p, "ignore")}>Listo, ya lo usé</button>
                )}
              </article>
            );
          }
          const sure = sureOne(p.suggestions);
          return (
            <article key={p.id} className="card !p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 min-w-[72px] rounded-xl bg-cream px-2.5 py-1.5 text-center text-sm text-ink dark:bg-transparent dark:ring-1 dark:ring-taupe/30">{SOURCE[p.source]}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] text-ink">{p.payer_name || "Nombre no encontrado"}</p>
                  <p className="text-[13.5px] text-ink/60">
                    {[p.paid_on || when(p.created_at), p.note ? `Nota: “${p.note}”` : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p className="font-heading text-3xl text-ink">{money(p.amount_cents)}</p>
              </div>

              {p.auth_status !== "pass" && p.status === "new" && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13.5px] text-amber-900">
                  No pudimos comprobar que este correo viene de {SOURCE[p.source]}. Revisa en la app antes de confirmar.
                </p>
              )}

              {p.status === "new" ? (
                <div className="mt-4">
                  {sure ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-cream/70 p-3 dark:bg-transparent dark:ring-1 dark:ring-taupe/20">
                      <p className="flex-1 text-[15px]">
                        Es la canasta <span className="font-heading text-2xl text-taupe">#{sure.basket_number}</span> · {sure.customer_name || "Sin nombre"} · {money(sure.total_cents)}
                        <span className="block text-[13px] text-ink/60">{sure.why.join(", ")}</span>
                      </p>
                      <button type="button" className="btn-primary min-h-[46px] !px-6" disabled={busy === p.id} onClick={() => act(p, "confirm", sure)}>
                        {busy === p.id ? "Guardando…" : "Confirmar"}
                      </button>
                    </div>
                  ) : p.suggestions.length ? (
                    <div>
                      <p className="mb-2 text-[14px] text-ink/70">{p.suggestions.length > 1 ? "¿Cuál canasta es?" : "¿Es esta canasta?"}</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {p.suggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            disabled={busy === p.id}
                            onClick={() => act(p, "confirm", s)}
                            className="min-h-[56px] rounded-2xl bg-white px-3 py-2 text-left ring-1 ring-taupe/30 hover:ring-taupe dark:bg-transparent"
                          >
                            <span className="font-heading text-xl text-taupe">#{s.basket_number}</span> <span className="text-[15px]">{s.customer_name || "Sin nombre"}</span>
                            <span className="block text-[13px] text-ink/60">{money(s.total_cents)} · {s.why.join(", ") || "parecido"}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-cream/70 px-3 py-3 text-[15px] text-ink/70 dark:bg-transparent dark:ring-1 dark:ring-taupe/20">No encontramos una canasta parecida.</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary min-h-[44px]"
                      onClick={() => {
                        setSearchFor(searchFor === p.id ? null : p.id);
                        setQuery("");
                      }}
                    >
                      {sure || p.suggestions.length ? "Es otra canasta" : "Buscar canasta"}
                    </button>
                    <button type="button" className="btn-secondary min-h-[44px]" disabled={busy === p.id} onClick={() => act(p, "ignore")}>
                      No es de un live
                    </button>
                  </div>
                  {searchBox(p.id)}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[14px] text-ink/70">
                  <span>
                    {p.status === "confirmed"
                      ? `Confirmado en la canasta #${p.basket_number ?? "?"}${p.confirmed_by ? " · " + p.confirmed_by : ""}`
                      : `No es de un live${p.confirmed_by ? " · " + p.confirmed_by : ""}`}
                  </span>
                  {p.status === "ignored" && (
                    <button type="button" className="underline" disabled={busy === p.id} onClick={() => act(p, "restore")}>Regresar a Nuevos</button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </Shell>
  );
}
