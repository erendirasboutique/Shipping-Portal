"use client";

// D · ¿Ya pagó? — Saturday. Scan the basket sticker (or type the number)
// and see right away:
//   PAGADO          -> Crear etiqueta de envío (opens Create Label with her order)
//   POR CONFIRMAR   -> she sent a photo of her payment: Sí, llegó / No lo veo
//   NO HA PAGADO    -> Mandar recordatorio, or mark it paid by hand

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Station from "@/components/equipo/Station";
import BarcodeScanner from "@/components/BarcodeScanner";
import { money, useEquipo, type EBasket } from "@/components/equipo/useEquipo";
import { shareNow } from "@/components/equipo/share";
import { getOperator } from "@/lib/live/operator";
import { reminderMessage } from "@/lib/live/messages";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/live/schema";

export default function EscanearPage() {
  const { data, setSale, reload } = useEquipo();
  const [scanning, setScanning] = useState(false);
  const [basket, setBasket] = useState<EBasket | null>(null);
  const [proof, setProof] = useState<{ url: string | null; method: string | null } | null>(null);
  const [num, setNum] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; warn?: boolean } | null>(null);
  const [manual, setManual] = useState(false);

  const lookup = useCallback(async (qs: string): Promise<string | null> => {
    setMsg(null);
    setManual(false);
    try {
      const res = await fetch("/api/equipo/canasta?" + qs, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) return json.error || "No encontramos esa canasta.";
      if (!json.basket) return "No hay canasta con ese número en este live.";
      setBasket(json.basket);
      setProof(null);
      if (json.basket.to_confirm) {
        fetch("/api/live/baskets/" + json.basket.id + "/payment-proof", { cache: "no-store" })
          .then((r) => r.json())
          .then((p) => setProof({ url: p.url || null, method: p.method || null }))
          .catch(() => setProof({ url: null, method: null }));
      }
      return null;
    } catch {
      return "Revisa tu conexión.";
    }
  }, []);

  // Opened from the QR with the phone camera: ?b=<basketId>
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("b");
    if (b) lookup("b=" + encodeURIComponent(b));
  }, [lookup]);

  async function byNumber() {
    if (!data?.sale || !num) return;
    const err = await lookup("sale=" + data.sale.id + "&n=" + encodeURIComponent(num));
    if (err) setMsg({ text: err, warn: true });
  }

  async function verify(ok: boolean) {
    if (!basket) return;
    setBusy(true);
    try {
      const res = await fetch("/api/equipo/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basket_id: basket.id, ok, by: getOperator() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo guardar.");
      setMsg({ text: ok ? "Listo: pago confirmado." + (json.warning ? " " + json.warning : "") : "Regresó a sin pagar.", warn: !!json.warning });
      await lookup("b=" + basket.id);
      reload();
    } catch (e: any) {
      setMsg({ text: e.message, warn: true });
    }
    setBusy(false);
  }

  async function markPaid(method: string) {
    if (!basket) return;
    setBusy(true);
    try {
      const res = await fetch("/api/live/baskets/" + basket.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid", payment_method: method, by: getOperator() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo guardar.");
      setMsg({ text: "Marcada pagada." + (json.warning ? " " + json.warning : ""), warn: !!json.warning });
      await lookup("b=" + basket.id);
      reload();
    } catch (e: any) {
      setMsg({ text: e.message, warn: true });
    }
    setBusy(false);
  }

  function remind() {
    if (!basket?.customer?.token) return setMsg({ text: "Esta clienta no tiene enlace todavía.", warn: true });
    const text = reminderMessage({
      locale: "es",
      customerName: basket.customer.name,
      basketNumber: basket.number,
      totalCents: basket.total_cents,
      portalToken: basket.customer.token,
    });
    shareNow(null, text).then((r) => {
      if (r === "copied") setMsg({ text: "Recordatorio copiado. Pégalo en su chat." });
    });
  }

  const state = !basket
    ? null
    : basket.to_confirm
      ? "confirm"
      : basket.paid
        ? "paid"
        : basket.status === "finalized"
          ? "unpaid"
          : "open";

  const look: Record<string, { box: string; pill: string; word: string }> = {
    paid: { box: "bg-taupe text-cream", pill: "bg-white text-ink", word: "PAGADO" },
    confirm: { box: "bg-white text-ink dark:bg-transparent", pill: "bg-cream text-ink", word: "POR CONFIRMAR" },
    unpaid: { box: "bg-white text-ink dark:bg-transparent", pill: "bg-red-50 text-red-800", word: "NO HA PAGADO" },
    open: { box: "bg-white text-ink dark:bg-transparent", pill: "bg-cream text-ink", word: "TODAVÍA NO SE MANDA" },
  };

  return (
    <Station title="¿Ya pagó?" eyebrow="Sábado" sale={data?.sale} sales={data?.sales} onSale={setSale}>
      <button type="button" className="btn-primary w-full !py-5 !text-[19px]" onClick={() => setScanning(true)}>
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8" /></svg>
        {basket ? "Escanear la siguiente" : "Escanear calcomanía"}
      </button>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="n">Número de canasta</label>
        <input id="n" className="input !text-lg" inputMode="numeric" placeholder="O escribe el número" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") byNumber(); }} />
        <button type="button" className="btn-secondary !py-3" onClick={byNumber}>Buscar</button>
      </div>

      {msg && <p role="status" className={"rounded-2xl px-4 py-3 text-[15px] " + (msg.warn ? "bg-amber-50 text-amber-900" : "bg-cream dark:bg-transparent")}>{msg.text}</p>}

      {basket && state && (
        <>
          <section className={"rounded-[2rem] p-6 text-center shadow-soft ring-1 ring-taupe/15 " + look[state].box}>
            <p className="text-[14px] tracking-[0.12em] opacity-80">FILA {basket.letter}</p>
            <p className="font-heading text-6xl leading-none">#{basket.number}</p>
            <p className="mt-1 font-heading text-3xl">{basket.customer?.name || "Sin clienta"}</p>
            <p className={"mx-auto mt-3 inline-block rounded-full px-5 py-2 font-heading text-2xl " + look[state].pill}>{look[state].word}</p>
            <p className="mt-2 text-[16px] opacity-80">
              {money(basket.total_cents)}
              {basket.paid && basket.payment_method ? " · " + paymentMethodLabel(basket.payment_method) : ""}
            </p>
          </section>

          {state === "paid" && (
            <div className="space-y-2">
              {basket.order_id ? (
                <Link href={"/create-label?draft=" + basket.order_id} className="btn-primary w-full !py-4 !text-[18px]">Crear etiqueta de envío</Link>
              ) : (
                <Link href="/create-label" className="btn-primary w-full !py-4 !text-[18px]">Crear etiqueta de envío</Link>
              )}
              <p className="text-center text-[14.5px] text-ink/60">Ponla en la pila de etiquetas.</p>
            </div>
          )}

          {state === "confirm" && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-taupe/20 dark:bg-transparent">
                {proof?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={proof.url} alt="La captura de pago que mandó" className="max-h-[420px] w-full object-contain" />
                ) : (
                  <p className="p-4 text-[15px] text-ink/60">{proof ? "No mandó captura." : "Cargando la captura…"}</p>
                )}
              </div>
              <p className="text-center text-[15px] text-ink/70">Dice que pagó por {proof?.method ? paymentMethodLabel(proof.method.replace("_", "")) : "otra app"}. Revisa en la app.</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn-primary !py-4 !text-[17px]" disabled={busy} onClick={() => verify(true)}>Sí, llegó</button>
                <button type="button" className="btn-secondary !py-4 !text-[17px]" disabled={busy} onClick={() => verify(false)}>No lo veo</button>
              </div>
            </div>
          )}

          {state === "unpaid" && (
            <div className="space-y-2">
              <button type="button" className="btn-primary w-full !py-4 !text-[17px]" onClick={remind}>Mandar recordatorio</button>
              <button type="button" className="btn-secondary w-full !py-3" onClick={() => setManual(!manual)}>Marcar pagado a mano</button>
              {manual && (
                <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Cómo pagó">
                  {PAYMENT_METHODS.map((m) => (
                    <button key={m.value} type="button" disabled={busy} onClick={() => markPaid(m.value)} className="min-h-[44px] rounded-full bg-white px-4 text-[15px] ring-1 ring-taupe/30 hover:ring-taupe dark:bg-transparent">
                      {m.label_es}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-center text-[14.5px] text-ink/60">Déjala en la fila {basket.letter}.</p>
            </div>
          )}

          {state === "open" && (
            <Link href="/equipo/canasta" className="btn-secondary w-full !py-4">Mandar foto y total primero</Link>
          )}
        </>
      )}

      {scanning && (
        <BarcodeScanner
          title="Escanea la calcomanía"
          onClose={() => setScanning(false)}
          onCode={async (code: string) => {
            const err = await lookup("b=" + encodeURIComponent(code));
            if (!err) setScanning(false);
            return err;
          }}
        />
      )}
    </Station>
  );
}
