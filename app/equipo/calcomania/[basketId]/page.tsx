"use client";

// One basket's sticker on its own page (reprints, or printing from a
// computer next to the label printer). ?auto=1 opens the print dialog once
// the QR has loaded.

import { useEffect, useState } from "react";
import Sticker from "@/components/equipo/Sticker";

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

  return (
    <div style={{ padding: 12, fontFamily: "system-ui" }}>
      <Sticker id={b.id} number={b.number} letter={b.letter} name={b.customer?.name || ""} onQrReady={() => setQrReady(true)} />
      <p style={{ fontSize: 14, color: "#555", marginTop: 12 }}>Tamaño 2.25 × 1.25 pulgadas.</p>
      <button type="button" onClick={() => window.print()} style={{ minHeight: 48, padding: "0 20px", borderRadius: 999, border: 0, background: "#957f67", color: "#fff", fontSize: 16 }}>
        Imprimir
      </button>
    </div>
  );
}
