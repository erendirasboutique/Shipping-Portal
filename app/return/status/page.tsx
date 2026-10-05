"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

// Same background as the return page. Swap the file in /public to change it.
const BG_IMAGE = "/return-bg.jpg";
const LOGO = "/EB_Logo_Fall BGBLANK.png";
const MESSENGER_URL = "https://ebtq.io/messenger";
const POLICY_URL = "https://www.erendirasboutique.com/return-policy";
const RETURN_URL = "/return";
const CODE_PREFIX = "EB-";

/* Brand colors
   brown  #5B4A38  text, buttons
   muted  #7A6A57  secondary text
   line   #CFC3B4  borders
   cream  #F5F3EF  soft fills                                          */

type Lang = "en" | "es";

const T = {
  en: {
    language: "Language",
    title: "Your Return",
    subtitle: "Enter your return code to check status and print your label.",
    codeLabel: "Return code",
    check: "Check",
    checking: "Checking…",
    genericError: "Something went wrong. Try again.",
    hi: (name: string) => `Hi ${name}`,
    returnWord: "Return",
    progress: "Return progress",
    steps: ["Requested", "Label ready", "In transit", "Received"],
    noRequest: "This code hasn't been used to start a return yet.",
    startReturn: "Start your return",
    notStarted: "Haven't started a return?",
    startOne: "Start one",
    submitted: (name?: string) =>
      `${name ? `Thanks, ${name}! ` : ""}Your return request is in. We're preparing your prepaid USPS label — check back here soon with this same code to print it.`,
    prepaidLabel: (carrier: string) => `Prepaid ${carrier} label`,
    ready: "Ready",
    preparing: "Preparing",
    notReady: "Label not ready yet",
    printLabel: "Print return label",
    opening: "Opening…",
    shareLink: "Share link",
    copied: "Link copied!",
    shareTitle: "Erendira's Boutique Return Label",
    copyPrompt: "Copy this link:",
    trackReturn: "Track",
    instructions: "Instructions",
    tip1: "Print the label and tape it to your package.",
    tip2: "Place the packing slip inside before sealing.",
    tip3: "Drop it off at any USPS location near you.",
    nearestUsps: "Find the nearest USPS",
    policy: "Return policy",
    questions: "Questions? Message us",
    instructionsPdf: "/return-instructions.pdf",
  },
  es: {
    language: "Idioma",
    title: "Tu Devolución",
    subtitle: "Ingresa tu código de devolución para ver el estado e imprimir tu etiqueta.",
    codeLabel: "Código de devolución",
    check: "Buscar",
    checking: "Buscando…",
    genericError: "Algo salió mal. Inténtalo de nuevo.",
    hi: (name: string) => `Hola ${name}`,
    returnWord: "Devolución",
    progress: "Progreso de la devolución",
    steps: ["Solicitada", "Etiqueta lista", "En camino", "Recibida"],
    noRequest: "Este código aún no se ha usado para iniciar una devolución.",
    startReturn: "Inicia tu devolución",
    notStarted: "¿Aún no inicias una devolución?",
    startOne: "Iníciala aquí",
    submitted: (name?: string) =>
      `${name ? `¡Gracias, ${name}! ` : ""}Recibimos tu solicitud de devolución. Estamos preparando tu etiqueta prepagada de USPS — vuelve pronto con este mismo código para imprimirla.`,
    prepaidLabel: (carrier: string) => `Etiqueta prepagada de ${carrier}`,
    ready: "Lista",
    preparing: "En preparación",
    notReady: "Etiqueta aún no disponible",
    printLabel: "Imprimir etiqueta",
    opening: "Abriendo…",
    shareLink: "Compartir",
    copied: "¡Enlace copiado!",
    shareTitle: "Etiqueta de Devolución — Erendira's Boutique",
    copyPrompt: "Copia este enlace:",
    trackReturn: "Rastrear",
    instructions: "Instrucciones",
    tip1: "Imprime la etiqueta y pégala a tu paquete.",
    tip2: "Coloca la hoja de empaque adentro antes de cerrarlo.",
    tip3: "Entrégalo en cualquier oficina de USPS cercana.",
    nearestUsps: "Encuentra la oficina de USPS más cercana",
    policy: "Política de devoluciones",
    questions: "¿Preguntas? Escríbenos",
    instructionsPdf: "/return-instructions.pdf",
  },
};

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function Icon({ d, size = 16 }: { d: string; size?: number }) {
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
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 7v5l3 2",
  chat: "M21 12a8 8 0 01-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1121 12z",
  external: "M7 17L17 7 M8 7h9v9",
};

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */

const outlineBtnCls =
  "flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#CFC3B4] bg-white " +
  "px-3 text-sm font-semibold text-[#5B4A38] transition hover:border-[#5B4A38]";

const linkCls = "inline-flex min-h-[44px] items-center gap-1.5 text-[#5B4A38] hover:text-[#3B3026]";

function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <Image src={BG_IMAGE} alt="" fill priority sizes="100vw" className="object-cover" />
    </div>
  );
}

function LangToggle({ lang, setLang, label }: { lang: Lang; setLang: (l: Lang) => void; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex rounded-full bg-white/85 p-1 shadow-[0_2px_8px_rgba(59,48,38,0.08)]"
    >
      {(["en", "es"] as Lang[]).map((l) => {
        const on = lang === l;
        return (
          <button
            key={l}
            type="button"
            aria-pressed={on}
            onClick={() => setLang(l)}
            className={
              "h-9 min-w-[44px] rounded-full px-3 text-[13px] font-semibold transition " +
              (on ? "bg-[#5B4A38] text-white" : "text-[#5B4A38] hover:bg-white")
            }
          >
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

type StepState = "done" | "current" | "pending" | "todo";

function Stepper({ stage, labels, label }: { stage: "submitted" | "label_ready"; labels: string[]; label: string }) {
  const icons = [ICONS.check, ICONS.tag, ICONS.truck, ICONS.box];
  const states: StepState[] =
    stage === "label_ready" ? ["done", "current", "todo", "todo"] : ["done", "pending", "todo", "todo"];

  return (
    <ol aria-label={label} className="mt-5 grid grid-cols-4 text-center text-xs sm:text-[13px]">
      {labels.map((text, i) => {
        const s = states[i];
        const lineDone = stage === "label_ready" && i === 0;
        return (
          <li
            key={text}
            aria-current={s === "current" || s === "pending" ? "step" : undefined}
            className={
              "relative flex flex-col items-center gap-2 " +
              (s === "todo" ? "text-[#7A6A57]" : "font-semibold text-[#5B4A38]")
            }
          >
            {i < labels.length - 1 && (
              <span
                aria-hidden
                className={"absolute left-1/2 top-[18px] h-0.5 w-full " + (lineDone ? "bg-[#5B4A38]" : "bg-[#E2D9CD]")}
              />
            )}
            <span
              className={
                "relative flex h-[38px] w-[38px] items-center justify-center rounded-full " +
                (s === "done"
                  ? "bg-[#5B4A38] text-white"
                  : s === "current"
                  ? "bg-[#5B4A38] text-white shadow-[0_0_0_5px_#EAE3D9]"
                  : s === "pending"
                  ? "border-2 border-dashed border-[#5B4A38] bg-white text-[#5B4A38]"
                  : "border-[1.5px] border-[#CFC3B4] bg-white text-[#7A6A57]")
              }
            >
              <Icon d={icons[i]} size={16} />
            </span>
            {text}
          </li>
        );
      })}
    </ol>
  );
}

function Tip({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 sm:flex-col sm:gap-2.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5F3EF] text-[#5B4A38]">
        <Icon d={icon} size={18} />
      </span>
      <span className="pt-2 text-sm leading-snug text-[#5B4A38] sm:pt-0">{children}</span>
    </li>
  );
}

function normalizeCode(v: string) {
  // Customers can type just the 6 characters or paste the full "EB-XXXXXX" code.
  return v.toUpperCase().replace(/\s+/g, "").replace(/^EB-/, "");
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ReturnStatusPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [code, setCode] = useState(""); // without the EB- prefix
  const [checkedCode, setCheckedCode] = useState(""); // full code of the last successful lookup
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<any | null>(null);
  const [opening, setOpening] = useState(false);
  const [copied, setCopied] = useState(false);

  const t = T[lang];

  async function lookup(e?: FormEvent) {
    e?.preventDefault();
    if (!code) return;
    const full = CODE_PREFIX + code;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/returns/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: full }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t.genericError);
      setCheckedCode(full);
      setInfo(data);
    } catch (err: any) {
      setError(err.message);
    }
    setBusy(false);
  }

  function slipUrl() {
    return `${window.location.origin}/api/returns/slip?code=${encodeURIComponent(checkedCode)}&lang=${lang}`;
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

  const hasReturn = info && (info.state === "submitted" || info.state === "label_ready");

  return (
    <div className="relative isolate flex min-h-screen flex-col bg-[#DCD2C5] px-4 py-5 text-[#5B4A38] sm:px-6 sm:py-6">
      <Background />

      <div className="mx-auto flex w-full max-w-[1200px] justify-end">
        <LangToggle lang={lang} setLang={setLang} label={t.language} />
      </div>

      <main className="flex flex-1 items-center justify-center py-6 sm:py-8">
        <section
          className="flex w-full max-w-[620px] flex-col rounded-3xl bg-white px-5 pb-6 pt-10 shadow-[0_2px_4px_rgba(59,48,38,0.06),0_24px_60px_rgba(59,48,38,0.18)] sm:px-10 sm:pb-7 sm:pt-11"
        >
          <Image
            src={LOGO}
            alt="Erendira's Boutique"
            width={220}
            height={95}
            priority
            className="mx-auto h-auto w-[190px] sm:w-[220px]"
          />
          <h1 className="font-body mt-6 text-center text-[28px] leading-tight sm:text-[32px]">{t.title}</h1>
          <p className="mt-2 text-center text-base text-[#7A6A57]">{t.subtitle}</p>

          {/* Code lookup */}
          <form onSubmit={lookup} className="mt-6 flex gap-2.5">
            <label htmlFor="status-code" className="sr-only">
              {t.codeLabel}
            </label>
            <div className="flex h-[54px] min-w-0 flex-1 overflow-hidden rounded-[14px] border-[1.5px] border-[#CFC3B4] bg-white transition focus-within:border-[#5B4A38] focus-within:ring-2 focus-within:ring-[#5B4A38]/15">
              <span className="flex items-center border-r-[1.5px] border-[#CFC3B4] bg-[#F5F3EF] px-3.5 font-mono text-[17px] font-semibold tracking-[0.08em] text-[#7A6A57]">
                {CODE_PREFIX}
              </span>
              <input
                id="status-code"
                value={code}
                onChange={(e) => setCode(normalizeCode(e.target.value))}
                placeholder="XXXXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent px-3.5 font-mono text-[17px] uppercase tracking-[0.2em] text-[#5B4A38] outline-none placeholder:text-[#B7A693]"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !code}
              className="h-[54px] shrink-0 rounded-[14px] bg-[#5B4A38] px-6 text-[15px] font-semibold text-white transition hover:bg-[#4A3B2C] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? t.checking : t.check}
            </button>
          </form>

          {error && (
            <div role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!info && (
            <p className="mt-4 text-center text-sm text-[#7A6A57]">
              {t.notStarted}{" "}
              <Link href={RETURN_URL} className="font-semibold text-[#5B4A38] underline underline-offset-2">
                {t.startOne}
              </Link>
            </p>
          )}

          {/* Code not used yet */}
          {info?.state === "no_request" && (
            <div className="mt-6 rounded-[18px] bg-[#F5F3EF] p-6 text-center">
              <p className="text-[15px] text-[#5B4A38]">{t.noRequest}</p>
              <Link
                href={RETURN_URL}
                className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-[#5B4A38] px-6 text-[15px] font-semibold text-white transition hover:bg-[#4A3B2C]"
              >
                {t.startReturn}
              </Link>
            </div>
          )}

          {hasReturn && (
            <>
              <div className="my-6 h-px bg-[#EAE3D9]" />

              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                {info.first_name ? (
                  <h2 className="font-body text-xl">{t.hi(info.first_name)}</h2>
                ) : (
                  <span />
                )}
                <p className="text-[13px] text-[#7A6A57]">
                  {t.returnWord}{" "}
                  <strong className="font-mono tracking-[0.06em] text-[#5B4A38]">{checkedCode}</strong>
                </p>
              </div>

              <Stepper stage={info.state} labels={t.steps} label={t.progress} />

              {/* Label card */}
              <div className="mt-7 rounded-[18px] bg-[#F5F3EF] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-body text-xl">{t.prepaidLabel(info.carrier || "USPS")}</p>
                    {info.state === "label_ready" && info.tracking_number && (
                      <p className="mt-1 break-words font-mono text-sm tracking-[0.04em] text-[#7A6A57]">
                        {formatTracking(info.tracking_number)}
                      </p>
                    )}
                    {info.state === "submitted" && (
                      <p className="mt-1.5 max-w-[400px] text-sm leading-relaxed text-[#7A6A57]">
                        {t.submitted(info.first_name)}
                      </p>
                    )}
                  </div>
                  {info.state === "label_ready" ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#5B4A38] px-3 py-1 text-xs font-semibold text-white">
                      <Icon d={ICONS.check} size={12} />
                      {t.ready}
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#CFC3B4] bg-white px-3 py-1 text-xs font-semibold">
                      <Icon d={ICONS.clock} size={12} />
                      {t.preparing}
                    </span>
                  )}
                </div>

                {info.state === "label_ready" ? (
                  <>
                    <button
                      type="button"
                      onClick={printLabel}
                      disabled={opening}
                      className="mt-5 flex h-14 w-full items-center justify-center gap-2.5 rounded-[14px] bg-[#5B4A38] text-base font-semibold text-white transition hover:bg-[#4A3B2C] disabled:opacity-60"
                    >
                      <Icon d={ICONS.printer} size={18} />
                      {opening ? t.opening : t.printLabel}
                    </button>

                    <div className="mt-2.5 flex flex-wrap gap-2.5">
                      <button type="button" onClick={shareLabel} className={outlineBtnCls} aria-live="polite">
                        <Icon d={copied ? ICONS.check : ICONS.share} />
                        {copied ? t.copied : t.shareLink}
                      </button>
                      {info.tracking_url ? (
                        <a href={info.tracking_url} target="_blank" rel="noreferrer" className={outlineBtnCls}>
                          <Icon d={ICONS.pin} />
                          {t.trackReturn}
                        </a>
                      ) : null}
                      <a href={t.instructionsPdf} target="_blank" rel="noreferrer" className={outlineBtnCls}>
                        <Icon d={ICONS.help} />
                        {t.instructions}
                      </a>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-5 flex h-14 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-[14px] bg-[#EAE3D9] text-base font-semibold text-[#7A6A57]"
                  >
                    <Icon d={ICONS.printer} size={18} />
                    {t.notReady}
                  </button>
                )}
              </div>

              {/* Tips */}
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Tip icon={ICONS.printer}>{t.tip1}</Tip>
                <Tip icon={ICONS.slip}>{t.tip2}</Tip>
                <Tip icon={ICONS.store}>{t.tip3}</Tip>
              </ul>
            </>
          )}

          {/* Footer links */}
          <div className="mb-1 mt-6 h-px bg-[#EAE3D9]" />
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-0 text-sm font-semibold">
            {info?.state === "label_ready" && (
              <a href={uspsMapUrl} target="_blank" rel="noreferrer" className={linkCls}>
                {t.nearestUsps}
                <Icon d={ICONS.external} size={14} />
              </a>
            )}
            <a href={POLICY_URL} target="_blank" rel="noopener noreferrer" className={linkCls}>
              {t.policy}
              <Icon d={ICONS.external} size={14} />
            </a>
            <a href={MESSENGER_URL} target="_blank" rel="noopener noreferrer" className={linkCls}>
              <Icon d={ICONS.chat} />
              {t.questions}
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
