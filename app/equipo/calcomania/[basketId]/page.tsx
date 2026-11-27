"use client";

// The basket sticker, sized for a small label printer (2.25 × 1.25 in):
// big floor-line letter, basket number, name, and a QR the Saturday scan
// reads. ?auto=1 opens the print dialog once the QR has loaded.

import { useEffect, useState } from "react";

type B = { id: string; number: number; letter: string; customer: { name: string } | null };

export default function Calcomania({ params }: { params: { basketId: string } }) {
  const [b, setB] = useState<B | null>(null);
  const [err, setErr] = useState("");
  const [qrReady, setQrReady] = useState(false);

  useEffect(() => {
    fetch("/api/equipo/canasta?b=" + encodeURIComponent(params.basketId), { cache: "no-store" })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => (ok && j.basket ? setB(j.basket) : setErr(j.error || "No encontramos la canasta.")))
      .catch(() => setErr("No se pudo cargar."));
  }, [params.basketId]);

  useEffect(() => {
    if (!b || !qrReady) return;
    if (new URLSearchParams(window.location.search).get("auto") === "1") {
      const id = window.setTimeout(() => window.print(), 300);
      return () => window.clearTimeout(id);
    }
  }, [b, qrReady]);

  if (err) return <p style={{ padding: 16, fontFamily: "system-ui" }}>{err}</p>;
  if (!b) return <p style={{ padding: 16, fontFamily: "system-ui" }}>…</p>;

  const name = b.customer?.name || "";
  return (
    <>
      <style>{`
        @page { size: 2.25in 1.25in; margin: 0; }
        html, body { margin: 0; background: #fff; }
        .stk { width: 2.25in; height: 1.25in; box-sizing: border-box; padding: 0.06in 0.08in; display: flex; align-items: center; gap: 0.08in; color: #000; font-family: var(--font-heading, Georgia), Georgia, serif; overflow: hidden; }
        .stk__l { width: 0.78in; height: 1.05in; border-radius: 0.08in; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.8in; line-height: 1; flex: none; }
        .stk__m { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
        .stk__n { font-size: 0.34in; line-height: 1; }
        .stk__name { font-family: system-ui, sans-serif; font-size: 0.13in; line-height: 1.15; margin-top: 0.04in; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .stk__q { width: 0.62in; height: 0.62in; flex: none; }
        .hint { font-family: system-ui, sans-serif; font-size: 14px; color: #555; padding: 12px; }
        @media print { .hint { display: none; } }
      `}</style>
      <div className="stk" role="img" aria-label={`Calcomanía: fila ${b.letter}, canasta ${b.number}, ${name}`}>
        <div className="stk__l">{b.letter}</div>
        <div className="stk__m">
          <span className="stk__n">#{b.number}</span>
          <span className="stk__name">{name}</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="stk__q" src={"/api/equipo/qr?b=" + b.id} alt="" onLoad={() => setQrReady(true)} onError={() => setQrReady(true)} />
      </div>
      <p className="hint">Tamaño 2.25 × 1.25 pulgadas. Si no se abrió la ventana de imprimir, usa Compartir → Imprimir.</p>
    </>
  );
}
