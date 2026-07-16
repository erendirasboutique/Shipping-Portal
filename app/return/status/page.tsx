"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const TAUPE = "#806a52";
const SAND = "#bda891";

type Lang = "en" | "es";

const T = {
  en: {
    title: "Your Return",
    subtitle: "Enter your return code to check status and print your label.",
    placeholder: "EB-XXXXXX",
    check: "Check",
    checking: "Checking…",
    genericError: "Something went wrong. Try again.",
    returnCode: "Return code",
    steps: ["Requested", "Label ready", "In transit", "Received"],
    noRequest: "This code hasn't been used to start a return yet.",
    startReturn: "Start your return",
    submitted: (name?: string) =>
      `${name ? `Thanks, ${name}! ` : ""}Your return request is in. We're preparing your prepaid USPS label — check back here soon with this same code to print it.`,
    prepaidLabel: (carrier: string) => `Prepaid ${carrier} label`,
    ready: "READY",
    printLabel: "Print Return Label",
    opening: "Opening…",
    shareLink: "Share label link",
    copied: "Link copied!",
    shareTitle: "Erendira's Boutique Return Label",
    copyPrompt: "Copy this link:",
    trackReturn: "Track Return",
    instructions: "Instructions",
    tip1: "Print the label and tape it to your package",
    tip2: "Place the packing slip inside before sealing",
    tip3: "Drop off at any USPS location near you",
    needHelp: "Need help with your return?",
    nearestUsps: "Find the nearest USPS",
    instructionsPdf: "/return-instructions.pdf",
  },
  es: {
    title: "Tu Devolución",
    subtitle: "Ingresa tu código de devolución para ver el estado e imprimir tu etiqueta.",
    placeholder: "EB-XXXXXX",
    check: "Buscar",
    checking: "Buscando…",
    genericError: "Algo salió mal. Inténtalo de nuevo.",
    returnCode: "Código de devolución",
    steps: ["Solicitada", "Etiqueta lista", "En camino", "Recibida"],
    noRequest: "Este código aún no se ha usado para iniciar una devolución.",
    startReturn: "Inicia tu devolución",
    submitted: (name?: string) =>
      `${name ? `¡Gracias, ${name}! ` : ""}Recibimos tu solicitud de devolución. Estamos preparando tu etiqueta prepagada de USPS — vuelve pronto con este mismo código para imprimirla.`,
    prepaidLabel: (carrier: string) => `Etiqueta prepagada de ${carrier}`,
    ready: "LISTA",
    printLabel: "Imprimir Etiqueta",
    opening: "Abriendo…",
    shareLink: "Compartir enlace",
    copied: "¡Enlace copiado!",
    shareTitle: "Etiqueta de Devolución — Erendira's Boutique",
    copyPrompt: "Copia este enlace:",
    trackReturn: "Rastrear Devolución",
    instructions: "Instrucciones",
    tip1: "Imprime la etiqueta y pégala a tu paquete",
    tip2: "Coloca la hoja de empaque adentro antes de cerrarlo",
    tip3: "Entrégalo en cualquier oficina de USPS cercana",
    needHelp: "¿Necesitas ayuda con tu devolución?",
    nearestUsps: "Encuentra la oficina de USPS más cercana",
    instructionsPdf: "/return-instructions.pdf",
  },
};

function Icon({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  check: "M5 12l5 5L20 7",
  tag: "M20 12l-8 8-9-9V4h7l10 8z M7.5 7.5h.01",
  truck: "M1 8h12v8H1z M13 10h4l4 4v2h-8z M6 19a2 2 0 100-4 2 2 0 000 4z M17 19a2 2 0 100-4 2 2 0 000 4z",
  box: "M12 3l9 4.5v9L12 21l-9-4.5v-9L12 3z M12 12l9-4.5 M12 12L3 7.5 M12 12v9",
  printer: "M6 9V3h12v6 M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2 M6 14h12v7H6z",
  pin: "M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z M12 12a2 2 0 100-4 2 2 0 000 4z",
  help: "M12 22a10 10 0 100-20 10 10 0 000 20z M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5 M12 17h.01",
  slip: "M7 3h10a2 2 0 012 2v16l-3-2-3 2-3-2-3 2V5a2 2 0 012-2z M9 8h6 M9 12h6",
  store: "M3 9l1.5-5h15L21 9 M3 9v11h18V9 M3 9c0 1.5 1.5 3 3 3s3-1.5 3-3c0 1.5 1.5 3 3 3s3-1.5 3-3c0 1.5 1.5 3 3 3s3-1.5 3-3 M9 20v-6h6v6",
  share: "M18 8a3 3 0 100-6 3 3 0 000 6z M6 15a3 3 0 100-6 3 3 0 000 6z M18 22a3 3 0 100-6 3 3 0 000 6z M8.6 13.5l6.8 4 M15.4 6.5l-6.8 4",
};

type StepState = "done" | "current" | "todo";

function Step({ icon, label, state }: { icon: string; label: string; state: StepState }) {
  const done = state === "done";
  const current = state === "current";
  return (
    <div className="flex-1 text-center">
      <div
        className="mx-auto flex h-7 w-7 items-center justify-center rounded-full"
        style={
          done || current
            ? { background: TAUPE, color: "#F5F3EF" }
            : { background: "#F5F3EF", border: "1.5px solid #D8CDBD", color: SAND }
        }
      >
        <Icon d={done ? ICONS.check : icon} size={14} />
      </div>
      <p
        className="mt-1.5 text-[11px] leading-tight"
        style={{ color: done || current ? TAUPE : "#B3A48F", fontWeight: current ? 600 : 400 }}
      >
        {label}
      </p>
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return <div className="mt-3.5 h-0.5 flex-1" style={{ background: active ? TAUPE : "#E2D9CC" }} />;
}

function Stepper({ stage, labels }: { stage: "submitted" | "label_ready"; labels: string[] }) {
  const labelState: StepState = stage === "label_ready" ? "current" : "todo";
  return (
    <div className="mt-7 flex items-start px-1">
      <Step icon={ICONS.check} label={labels[0]} state="done" />
      <Connector active={stage === "label_ready"} />
      <Step icon={ICONS.tag} label={labels[1]} state={labelState} />
      <Connector active={false} />
      <Step icon={ICONS.truck} label={labels[2]} state="todo" />
      <Connector active={false} />
      <Step icon={ICONS.box} label={labels[3]} state="todo" />
    </div>
  );
}

function Tip({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-1 items-start gap-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: "#F5F3EF", color: TAUPE }}
      >
        <Icon d={icon} />
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "#6E6152" }}>{text}</p>
    </div>
  );
}

export default function ReturnStatusPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<any | null>(null);
  const [opening, setOpening] = useState(false);
  const [copied, setCopied] = useState(false);

  const t = T[lang];

  async function lookup() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/returns/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t.genericError);
      setInfo(data);
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  }

  function slipUrl() {
    return `${window.location.origin}/api/returns/slip?code=${encodeURIComponent(
      code.trim().toUpperCase()
    )}&lang=${lang}`;
  }

  function printLabel() {
    setOpening(true);
    window.open(slipUrl(), "_blank");
    setTimeout(() => setOpening(false), 800);
  }

  async function shareLabel() {
    const url = slipUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: t.shareTitle, url });
        return;
      } catch {
        // user cancelled — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t.copyPrompt, url);
    }
  }

  const uspsMapUrl = info?.zip
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`USPS near ${info.zip}`)}`
    : "https://www.google.com/maps/search/?api=1&query=USPS";

  const formatTracking = (tn?: string) => (tn ? tn.replace(/(.{4})/g, "$1 ").trim() : "");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F3EF] px-4 py-10">
      <div className="card relative w-full max-w-lg !rounded-[2rem]">
        <div className="absolute right-5 top-5 flex overflow-hidden rounded-full border" style={{ borderColor: "#D8CDBD" }}>
          <button
            onClick={() => setLang("en")}
            className="px-3 py-1 text-[11px] tracking-wide"
            style={lang === "en" ? { background: TAUPE, color: "#F5F3EF" } : { background: "#fff", color: TAUPE }}
          >
            EN
          </button>
          <button
            onClick={() => setLang("es")}
            className="px-3 py-1 text-[11px] tracking-wide"
            style={lang === "es" ? { background: TAUPE, color: "#F5F3EF" } : { background: "#fff", color: TAUPE }}
          >
            ES
          </button>
        </div>

        <div className="text-center">
          <Image src="/logo2.png" alt="Erendira's Boutique" width={120} height={52} className="mx-auto h-auto w-28" />
          <h1 className="mt-5 text-3xl">{t.title}</h1>
          <p className="mt-2 text-sm text-ink/70">{t.subtitle}</p>
        </div>

        <div className="mt-6 flex gap-2">
          <input
            className="input text-center font-mono uppercase tracking-[0.25em]"
            placeholder={t.placeholder}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
          <button onClick={lookup} disabled={busy || !code.trim()} className="btn-primary shrink-0">
            {busy ? t.checking : t.check}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {info && (info.state === "submitted" || info.state === "label_ready") && (
          <p className="mt-4 text-center text-xs" style={{ color: "#8A7B68" }}>
            {t.returnCode}{" "}
            <span className="font-mono tracking-[0.15em]" style={{ color: TAUPE }}>
              {code.trim().toUpperCase()}
            </span>
            {info.first_name ? ` · ${info.first_name}` : ""}
          </p>
        )}

        {info?.state === "no_request" && (
          <div className="mt-6 rounded-2xl border border-taupe/20 bg-cream/60 p-5 text-center">
            <p className="text-sm text-ink/80">{t.noRequest}</p>
            <Link href="/return" className="btn-primary mt-4 inline-flex">
              {t.startReturn}
            </Link>
          </div>
        )}

        {info?.state === "submitted" && (
          <>
            <Stepper stage="submitted" labels={t.steps} />
            <div className="mt-6 rounded-2xl border border-taupe/20 bg-cream/60 p-5 text-center">
              <p className="text-sm leading-relaxed text-ink/80">{t.submitted(info.first_name)}</p>
            </div>
          </>
        )}

        {info?.state === "label_ready" && (
          <>
            <Stepper stage="label_ready" labels={t.steps} />

            <div className="mt-6 rounded-[20px] border p-6" style={{ background: "#F5F3EF", borderColor: "#E5DBCC" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[15px]" style={{ color: "#3D342A" }}>
                    {t.prepaidLabel(info.carrier || "USPS")}
                  </p>
                  {info.tracking_number && (
                    <p className="mt-1 font-mono text-xs" style={{ color: "#8A7B68" }}>
                      {formatTracking(info.tracking_number)}
                    </p>
                  )}
                </div>
                <span
                  className="rounded-full px-3 py-1 text-[11px] tracking-[0.15em]"
                  style={{ background: "#EDE7DB", color: TAUPE }}
                >
                  {t.ready}
                </span>
              </div>

              <button
                onClick={printLabel}
                disabled={opening}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: TAUPE, color: "#F5F3EF" }}
              >
                <Icon d={ICONS.printer} size={16} />
                {opening ? t.opening : t.printLabel}
              </button>

              <button
                onClick={shareLabel}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-full border bg-white py-2.5 text-[13px]"
                style={{ borderColor: "#D8CDBD", color: TAUPE }}
              >
                <Icon d={copied ? ICONS.check : ICONS.share} size={14} />
                {copied ? t.copied : t.shareLink}
              </button>

              <div className="mt-2.5 flex gap-2.5">
                {info.tracking_url ? (
                  <a
                    href={info.tracking_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full border bg-white py-2.5 text-[13px]"
                    style={{ borderColor: "#D8CDBD", color: TAUPE }}
                  >
                    <Icon d={ICONS.pin} size={14} />
                    {t.trackReturn}
                  </a>
                ) : null}
                <a
                  href={t.instructionsPdf}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border bg-white py-2.5 text-[13px]"
                  style={{ borderColor: "#D8CDBD", color: TAUPE }}
                >
                  <Icon d={ICONS.help} size={14} />
                  {t.instructions}
                </a>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:gap-3">
              <Tip icon={ICONS.printer} text={t.tip1} />
              <Tip icon={ICONS.slip} text={t.tip2} />
              <Tip icon={ICONS.store} text={t.tip3} />
            </div>

            <div className="mt-6 border-t pt-4 text-center" style={{ borderColor: "#EFE9DE" }}>
              <span className="text-xs" style={{ color: "#A89A85" }}>
                {t.needHelp}{" "}
              </span>
              <a
                href={uspsMapUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline"
                style={{ color: TAUPE }}
              >
                {t.nearestUsps}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
