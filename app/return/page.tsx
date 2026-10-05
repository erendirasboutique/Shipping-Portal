"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import AddressAutocomplete from "@/components/AddressAutocomplete";

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

// Swap this file in /public to change the page background.
const BG_IMAGE = "/return-bg.jpg";
const LOGO = "/EB_Logo_Fall BGBLANK.png";
const MESSENGER_URL = "https://ebtq.io/messenger";
const POLICY_URL = "https://www.erendirasboutique.com/return-policy";
const STATUS_URL = "/return/status";
const CODE_PREFIX = "EB-";

/* Brand colors
   brown  #5B4A38  text, buttons
   muted  #7A6A57  secondary text
   taupe  #91806A  accents
   line   #CFC3B4  borders
   cream  #F5F3EF  soft fills                                          */

type Lang = "en" | "es";
type ReasonKey = "fit" | "pictured" | "damaged" | "mind" | "other";
const REASON_KEYS: ReasonKey[] = ["fit", "pictured", "damaged", "mind", "other"];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
  "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY", "PR", "VI", "GU", "AS", "MP", "AA", "AE", "AP",
];

const T = {
  en: {
    language: "Language",
    returns: "Returns",
    homeTitle: "Returns & Exchanges",
    homeSub: "Enter the return code provided by Erendira's Boutique to get started.",
    codeLabel: "Return code",
    missingCode: "Enter your return code.",
    notFound: "That return code wasn't found.",
    genericError: "Something went wrong. Try again.",
    alreadyUsed1: "This code has already been used to start a return.",
    alreadyUsedLink: "Check your return status",
    alreadyUsed2: "to see or print your label.",
    checking: "Checking...",
    start: "Start return",
    alreadyStarted: "Already started a return?",
    checkStatus: "Check status",
    policy: "Return policy",
    questions: "Questions? Message us",
    help: "Help",
    progress: "Progress",
    stepCode: "Return code",
    stepAddress: "Shipping address",
    stepLabel: "Prepaid label",
    addrTitle: "Your shipping address",
    addrSub:
      "Add the address you're shipping your return from. We'll prepare your prepaid USPS label, then you can print it from the return status page with your code.",
    contact: "Contact",
    shipping: "Shipping address",
    fullName: "Full name",
    email: "Email",
    phone: "Phone",
    optional: "(optional)",
    street: "Street address",
    streetPlaceholder: "Start typing your address",
    poweredBy: "Powered by Google",
    apt: "Apt, suite, unit",
    city: "City",
    state: "State",
    statePlaceholder: "Select",
    zip: "ZIP",
    reasonTitle: "Reason for return",
    reasons: {
      fit: "Doesn't fit",
      pictured: "Not as pictured",
      damaged: "Damaged or defective",
      mind: "Changed my mind",
      other: "Other",
    } as Record<ReasonKey, string>,
    otherLabel: "Tell us what's going on",
    otherPlaceholder: "Type your reason here",
    missingFields: "Please fill in your name, email and full address.",
    badEmail: "Please enter a valid email address.",
    submitting: "Submitting...",
    submit: "Submit return request",
    accepted: "Accepted",
    codeAccepted: "accepted",
    change: "Change",
    differentCode: "Use a different code",
    nextTitle: "What happens next",
    next1: "We prepare your prepaid USPS label.",
    next2: "When it's ready, print it from the return status page using your code.",
    next3: "Pack your item, attach the label and send it with USPS.",
    questionsTitle: "Questions?",
    questionsSub: "Message us on Messenger",
    received: "Request received",
    receivedMsg: (name: string) =>
      `Thanks${name ? `, ${name}` : ""}! We've received your return request. Once your prepaid USPS label is ready, come back and print it with your return code:`,
    checkReturnStatus: "Check return status",
  },
  es: {
    language: "Idioma",
    returns: "Devoluciones",
    homeTitle: "Devoluciones y Cambios",
    homeSub: "Ingresa el código de devolución proporcionado por Erendira's Boutique para comenzar.",
    codeLabel: "Código de devolución",
    missingCode: "Ingresa tu código de devolución.",
    notFound: "No se encontró ese código de devolución.",
    genericError: "Algo salió mal. Inténtalo de nuevo.",
    alreadyUsed1: "Este código ya se usó para iniciar una devolución.",
    alreadyUsedLink: "Consulta el estado de tu devolución",
    alreadyUsed2: "para ver o imprimir tu etiqueta.",
    checking: "Verificando...",
    start: "Iniciar devolución",
    alreadyStarted: "¿Ya iniciaste una devolución?",
    checkStatus: "Ver estado",
    policy: "Política de devoluciones",
    questions: "¿Preguntas? Escríbenos",
    help: "Ayuda",
    progress: "Progreso",
    stepCode: "Código",
    stepAddress: "Dirección de envío",
    stepLabel: "Etiqueta prepagada",
    addrTitle: "Tu dirección de envío",
    addrSub:
      "Agrega la dirección desde donde enviarás tu devolución. Prepararemos tu etiqueta prepagada de USPS y podrás imprimirla en la página de estado con tu código.",
    contact: "Contacto",
    shipping: "Dirección de envío",
    fullName: "Nombre completo",
    email: "Correo electrónico",
    phone: "Teléfono",
    optional: "(opcional)",
    street: "Dirección",
    streetPlaceholder: "Empieza a escribir tu dirección",
    poweredBy: "Con tecnología de Google",
    apt: "Apto, suite, unidad",
    city: "Ciudad",
    state: "Estado",
    statePlaceholder: "Elegir",
    zip: "Código postal",
    reasonTitle: "Motivo de la devolución",
    reasons: {
      fit: "No me queda",
      pictured: "No es como en la foto",
      damaged: "Dañado o defectuoso",
      mind: "Cambié de opinión",
      other: "Otro",
    } as Record<ReasonKey, string>,
    otherLabel: "Cuéntanos qué pasó",
    otherPlaceholder: "Escribe tu motivo aquí",
    missingFields: "Completa tu nombre, correo y dirección completa.",
    badEmail: "Ingresa un correo electrónico válido.",
    submitting: "Enviando...",
    submit: "Enviar solicitud de devolución",
    accepted: "Aceptado",
    codeAccepted: "aceptado",
    change: "Cambiar",
    differentCode: "Usar otro código",
    nextTitle: "Qué sigue",
    next1: "Preparamos tu etiqueta prepagada de USPS.",
    next2: "Cuando esté lista, imprímela en la página de estado de tu devolución con tu código.",
    next3: "Empaca tu artículo, pega la etiqueta y envíalo con USPS.",
    questionsTitle: "¿Preguntas?",
    questionsSub: "Escríbenos por Messenger",
    received: "Solicitud recibida",
    receivedMsg: (name: string) =>
      `¡Gracias${name ? `, ${name}` : ""}! Recibimos tu solicitud de devolución. Cuando tu etiqueta prepagada de USPS esté lista, vuelve e imprímela con tu código de devolución:`,
    checkReturnStatus: "Ver estado de devolución",
  },
};

const emptyForm = {
  name: "", street1: "", street2: "",
  city: "", state: "", zip: "", phone: "", email: "",
};

/* ------------------------------------------------------------------ */
/*  Shared styles                                                      */
/* ------------------------------------------------------------------ */

const inputCls =
  "h-[52px] w-full rounded-xl border-[1.5px] border-[#CFC3B4] bg-white px-4 text-base text-[#5B4A38] " +
  "placeholder:text-[#9C8D7B] outline-none transition focus:border-[#5B4A38] focus:ring-2 focus:ring-[#5B4A38]/15";

// Styles whatever <input> AddressAutocomplete renders so it matches the other fields.
const autocompleteWrapCls =
  "[&_input]:h-[52px] [&_input]:w-full [&_input]:rounded-xl [&_input]:border-[1.5px] [&_input]:border-[#CFC3B4] " +
  "[&_input]:bg-white [&_input]:px-4 [&_input]:text-base [&_input]:text-[#5B4A38] [&_input]:outline-none " +
  "[&_input:focus]:border-[#5B4A38] [&_input:focus]:ring-2 [&_input:focus]:ring-[#5B4A38]/15";

const labelCls = "text-sm font-semibold text-[#5B4A38]";
const hintCls = "font-normal text-[13px] text-[#7A6A57]";
const legendCls = "font-body mb-5 p-0 text-[21px] text-[#5B4A38]";
const primaryBtnCls =
  "h-14 w-full rounded-[14px] bg-[#5B4A38] text-base font-semibold text-white transition " +
  "hover:bg-[#4A3B2C] disabled:cursor-not-allowed disabled:opacity-60";
const cardShadow = "shadow-[0_2px_4px_rgba(59,48,38,0.05),0_20px_50px_rgba(59,48,38,0.12)]";

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */

function Svg({ children, size = 18, className }: { children: ReactNode; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}
const ChatIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" /></Svg>
);
const ExternalIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M7 17L17 7M8 7h9v9" /></Svg>
);
const CheckIcon = (p: { size?: number }) => (
  <Svg {...p}><path d="M5 12l5 5L20 7" /></Svg>
);
const MailIcon = () => (
  <Svg size={20}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></Svg>
);
const BoxIcon = () => (
  <Svg size={20}><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></Svg>
);
const ClockIcon = () => (
  <Svg size={20}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);

function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <Image src={BG_IMAGE} alt="" fill priority sizes="100vw" className="object-cover" />
    </div>
  );
}

function LangToggle({
  lang,
  setLang,
  label,
  className = "",
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`flex rounded-full p-1 ${className}`}>
      {(["en", "es"] as Lang[]).map(function (l) {
        const on = lang === l;
        return (
          <button
            key={l}
            type="button"
            aria-pressed={on}
            onClick={function () { setLang(l); }}
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

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-left text-sm text-red-700">
      {children}
    </div>
  );
}

function normalizeCode(v: string) {
  // Customers can type just the 6 characters or paste the full "EB-XXXXXX" code.
  return v.toUpperCase().replace(/\s+/g, "").replace(/^EB-/, "");
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PublicReturnPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [stage, setStage] = useState<"code" | "form" | "done">("code");
  const [code, setCode] = useState(""); // without the EB- prefix
  const [form, setForm] = useState({ ...emptyForm });
  const [reasonKey, setReasonKey] = useState<ReasonKey | null>(null);
  const [reasonOther, setReasonOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyUsed, setAlreadyUsed] = useState(false);

  const t = T[lang];
  const fullCode = code ? CODE_PREFIX + code : "";

  function set(key: keyof typeof emptyForm, value: string) {
    setForm(function (f) {
      return { ...f, [key]: value };
    });
  }

  async function unlock(e?: FormEvent) {
    e?.preventDefault();
    if (!code) {
      setError(t.missingCode);
      return;
    }
    setError(null);
    setAlreadyUsed(false);
    setBusy(true);
    try {
      const res = await fetch("/api/returns/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fullCode }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        throw new Error(data.error || t.notFound);
      }
      if (data.state === "submitted" || data.state === "label_ready" || data.used) {
        setAlreadyUsed(true);
        return;
      }
      setStage("form");
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function buildReason() {
    if (!reasonKey) return "";
    // Saved in English so your team always sees the same wording.
    const label = T.en.reasons[reasonKey];
    if (reasonKey === "other") {
      const text = reasonOther.trim();
      return text ? `${label}: ${text}` : label;
    }
    return label;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const f = form;
    if (!f.name.trim() || !f.email.trim() || !f.street1.trim() || !f.city.trim() || !f.state || !f.zip.trim()) {
      setError(t.missingFields);
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) {
      setError(t.badEmail);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/returns/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, reason: buildReason(), code: fullCode }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || t.genericError);
      setStage("done");
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      setError(err.message);
    }
    setBusy(false);
  }

  function switchCode() {
    setStage("code");
    setError(null);
    setAlreadyUsed(false);
  }

  /* ---------------- Footer links (home + done) ---------------- */
  const footerLinks = (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm font-semibold">
      <a
        href={POLICY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-[#5B4A38] hover:text-[#3B3026]"
      >
        {t.policy}
        <ExternalIcon size={14} />
      </a>
      <a
        href={MESSENGER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-[#5B4A38] hover:text-[#3B3026]"
      >
        <ChatIcon size={16} />
        {t.questions}
      </a>
    </div>
  );

  /* ---------------- Stage: code + done (centered card) ---------------- */
  if (stage !== "form") {
    return (
      <div className="relative isolate flex min-h-screen flex-col bg-[#DCD2C5] px-4 py-5 text-[#5B4A38] sm:px-6 sm:py-6">
        <Background />

        <div className="mx-auto flex w-full max-w-[1200px] justify-end">
          <LangToggle
            lang={lang}
            setLang={setLang}
            label={t.language}
            className="bg-white/85 shadow-[0_2px_8px_rgba(59,48,38,0.08)]"
          />
        </div>

        <main className="flex flex-1 items-center justify-center py-8 sm:py-10">
          <section
            className="w-full max-w-[500px] rounded-3xl bg-white px-6 pb-6 pt-10 text-center
                       shadow-[0_2px_4px_rgba(59,48,38,0.06),0_24px_60px_rgba(59,48,38,0.18)] sm:px-11 sm:pb-8 sm:pt-12"
          >
            <Image
              src={LOGO}
              alt="Erendira's Boutique"
              width={250}
              height={108}
              priority
              className="mx-auto h-auto w-[210px] sm:w-[250px]"
            />

            {stage === "code" && (
              <>
                <h1 className="font-body mt-8 text-[28px] leading-tight sm:text-[32px]">{t.homeTitle}</h1>
                <p className="mx-auto mt-2.5 max-w-[340px] text-base leading-relaxed text-[#7A6A57]">
                  {t.homeSub}
                </p>

                <form onSubmit={unlock} noValidate className="mt-8 flex flex-col gap-4 text-left">
                  {error && <ErrorBox>{error}</ErrorBox>}
                  {alreadyUsed && (
                    <div className="rounded-xl border border-[#CFC3B4] bg-[#F5F3EF] px-4 py-3 text-sm text-[#5B4A38]">
                      {t.alreadyUsed1}{" "}
                      <Link href={STATUS_URL} className="font-semibold underline underline-offset-2">
                        {t.alreadyUsedLink}
                      </Link>{" "}
                      {t.alreadyUsed2}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <label htmlFor="return-code" className={labelCls}>
                      {t.codeLabel}
                    </label>
                    <div
                      className="flex h-[58px] overflow-hidden rounded-[14px] border-[1.5px] border-[#CFC3B4] bg-white transition
                                 focus-within:border-[#5B4A38] focus-within:ring-2 focus-within:ring-[#5B4A38]/15"
                    >
                      <span className="flex items-center border-r-[1.5px] border-[#CFC3B4] bg-[#F5F3EF] px-4 font-mono text-[19px] font-semibold tracking-[0.08em] text-[#7A6A57]">
                        {CODE_PREFIX}
                      </span>
                      <input
                        id="return-code"
                        value={code}
                        onChange={function (e) {
                          setCode(normalizeCode(e.target.value));
                        }}
                        placeholder="XXXXXX"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        className="min-w-0 flex-1 bg-transparent px-4 font-mono text-[19px] uppercase tracking-[0.2em] text-[#5B4A38] outline-none placeholder:text-[#B7A693]"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={busy} className={primaryBtnCls}>
                    {busy ? t.checking : t.start}
                  </button>
                </form>

                <p className="mt-5 text-sm text-[#7A6A57]">
                  {t.alreadyStarted}{" "}
                  <Link href={STATUS_URL} className="font-semibold text-[#5B4A38] underline underline-offset-2">
                    {t.checkStatus}
                  </Link>
                </p>
              </>
            )}

            {stage === "done" && (
              <>
                <div className="mx-auto mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-[#F5F3EF] text-[#5B4A38] ring-1 ring-[#CFC3B4]">
                  <CheckIcon size={26} />
                </div>
                <h1 className="font-body mt-5 text-[28px] leading-tight sm:text-[32px]">{t.received}</h1>
                <p className="mx-auto mt-3 max-w-[360px] text-base leading-relaxed text-[#7A6A57]">
                  {t.receivedMsg(form.name.trim().split(" ")[0])}
                </p>
                <p className="mt-4 font-mono text-xl font-semibold tracking-[0.2em]">{fullCode}</p>
                <Link
                  href={STATUS_URL}
                  className={primaryBtnCls + " mt-6 inline-flex items-center justify-center"}
                >
                  {t.checkReturnStatus}
                </Link>
              </>
            )}

            <div className="mb-2 mt-7 h-px bg-[#EAE3D9]" />
            {footerLinks}
          </section>
        </main>
      </div>
    );
  }

  /* ---------------- Stage: shipping address form ---------------- */
  const steps = [
    { label: t.stepCode, state: "done" as const },
    { label: t.stepAddress, state: "current" as const },
    { label: t.stepLabel, state: "todo" as const },
  ];

  return (
    <div className="relative isolate flex min-h-screen flex-col bg-[#E6DED3] text-[#5B4A38]">
      <Background />

      {/* Top bar */}
      <header className="bg-white shadow-[0_1px_0_#E2D9CD,0_6px_20px_rgba(59,48,38,0.06)]">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-3 px-4 py-2 sm:px-6 sm:py-3">
          <div className="flex items-center gap-4">
            <Image src={LOGO} alt="Erendira's Boutique" width={190} height={82} priority className="h-[52px] w-auto sm:h-16" />
            <span className="font-body hidden border-l-[1.5px] border-[#E2D9CD] pl-4 text-lg leading-8 sm:block">
              {t.returns}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={MESSENGER_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.help}
              className="inline-flex h-11 w-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-[#CFC3B4] text-sm font-semibold transition hover:border-[#5B4A38] sm:w-auto sm:px-4"
            >
              <ChatIcon size={16} />
              <span className="hidden sm:inline">{t.help}</span>
            </a>
            <LangToggle lang={lang} setLang={setLang} label={t.language} className="bg-[#F5F3EF]" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-11">
        {/* Progress */}
        <nav aria-label={t.progress} className="mb-6 sm:mb-7">
          <ol className="inline-flex items-center gap-2 rounded-full bg-white/85 py-1.5 pl-1.5 pr-4 text-sm font-semibold sm:gap-3">
            {steps.map(function (s, i) {
              return (
                <li key={s.label} className="flex items-center gap-2 sm:gap-3" aria-current={s.state === "current" ? "step" : undefined}>
                  {i > 0 && <span aria-hidden className="h-[1.5px] w-4 bg-[#B7A693] sm:w-6" />}
                  <span className={"flex items-center gap-2 " + (s.state === "current" ? "text-[#5B4A38]" : "text-[#7A6A57]")}>
                    <span
                      className={
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs " +
                        (s.state === "done"
                          ? "border-[1.5px] border-[#91806A] bg-[#F5F3EF] text-[#5B4A38]"
                          : s.state === "current"
                          ? "bg-[#5B4A38] text-white"
                          : "border-[1.5px] border-[#B7A693]")
                      }
                    >
                      {s.state === "done" ? <CheckIcon size={14} /> : i + 1}
                    </span>
                    <span className={s.state === "current" ? "" : "hidden sm:inline"}>{s.label}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-7">
          {/* Form card */}
          <form
            onSubmit={submit}
            noValidate
            className={`flex min-w-0 flex-1 flex-col gap-8 rounded-3xl bg-white p-5 sm:gap-9 sm:p-11 ${cardShadow}`}
          >
            <div>
              <h1 className="font-body text-[30px] leading-tight sm:text-[38px]">{t.addrTitle}</h1>
              <p className="mt-2.5 max-w-[520px] text-base leading-relaxed text-[#7A6A57]">{t.addrSub}</p>

              {/* Code (phones and tablets; desktop shows it in the sidebar) */}
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#F5F3EF] py-1 pl-3.5 pr-1 lg:hidden">
                <span className="text-[13px] text-[#7A6A57]">
                  <strong className="font-mono tracking-[0.06em] text-[#5B4A38]">{fullCode}</strong> {t.codeAccepted}
                </span>
                <button
                  type="button"
                  onClick={switchCode}
                  className="inline-flex min-h-[44px] items-center px-2.5 text-[13px] font-semibold underline underline-offset-2"
                >
                  {t.change}
                </button>
              </div>
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}

            {/* Contact */}
            <fieldset className="flex flex-col gap-5">
              <legend className={legendCls}>{t.contact}</legend>
              <div className="flex flex-col gap-2">
                <label htmlFor="ret_name" className={labelCls}>{t.fullName}</label>
                <input
                  id="ret_name"
                  className={inputCls}
                  autoComplete="name"
                  value={form.name}
                  onChange={function (e) { set("name", e.target.value); }}
                />
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
                <div className="flex min-w-0 flex-col gap-2">
                  <label htmlFor="ret_email" className={labelCls}>
                    {t.email}
                  </label>
                  <input
                    id="ret_email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className={inputCls}
                    value={form.email}
                    onChange={function (e) { set("email", e.target.value); }}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <label htmlFor="ret_phone" className={labelCls}>
                    {t.phone} <span className={hintCls}>{t.optional}</span>
                  </label>
                  <input
                    id="ret_phone"
                    type="tel"
                    autoComplete="tel"
                    className={inputCls}
                    value={form.phone}
                    onChange={function (e) { set("phone", e.target.value); }}
                  />
                </div>
              </div>
            </fieldset>

            <div className="h-px bg-[#EAE3D9]" />

            {/* Shipping address */}
            <fieldset className="flex flex-col gap-5">
              <legend className={legendCls}>{t.shipping}</legend>
              <div className="flex flex-col gap-2">
                <span className={labelCls}>{t.street}</span>
                <div className={autocompleteWrapCls}>
                  <AddressAutocomplete
                    value={form.street1}
                    placeholder={t.streetPlaceholder}
                    poweredBy={t.poweredBy}
                    onChange={function (v) { set("street1", v); }}
                    onSelect={function (a) {
                      setForm(function (f) {
                        return { ...f, street1: a.street1, street2: a.street2 || f.street2, city: a.city, state: a.state, zip: a.zip };
                      });
                      setTimeout(function () {
                        const el = document.getElementById("ret_street2");
                        if (el) el.focus();
                      }, 0);
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="ret_street2" className={labelCls}>
                  {t.apt} <span className={hintCls}>{t.optional}</span>
                </label>
                <input
                  id="ret_street2"
                  className={inputCls}
                  autoComplete="address-line2"
                  value={form.street2}
                  onChange={function (e) { set("street2", e.target.value); }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="col-span-2 flex min-w-0 flex-col gap-2">
                  <label htmlFor="ret_city" className={labelCls}>{t.city}</label>
                  <input
                    id="ret_city"
                    className={inputCls}
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={function (e) { set("city", e.target.value); }}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <label htmlFor="ret_state" className={labelCls}>{t.state}</label>
                  <select
                    id="ret_state"
                    className={inputCls + " pr-2"}
                    autoComplete="address-level1"
                    value={form.state}
                    onChange={function (e) { set("state", e.target.value); }}
                  >
                    <option value="">{t.statePlaceholder}</option>
                    {form.state && !US_STATES.includes(form.state) && <option value={form.state}>{form.state}</option>}
                    {US_STATES.map(function (s) {
                      return <option key={s} value={s}>{s}</option>;
                    })}
                  </select>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <label htmlFor="ret_zip" className={labelCls}>{t.zip}</label>
                  <input
                    id="ret_zip"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    className={inputCls}
                    value={form.zip}
                    onChange={function (e) { set("zip", e.target.value); }}
                  />
                </div>
              </div>
            </fieldset>

            <div className="h-px bg-[#EAE3D9]" />

            {/* Reason */}
            <fieldset className="flex flex-col gap-4">
              <legend className={legendCls + " !mb-1"}>
                {t.reasonTitle} <span className="font-sans text-sm text-[#7A6A57]">{t.optional}</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {REASON_KEYS.map(function (k) {
                  const on = reasonKey === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={function () { setReasonKey(on ? null : k); }}
                      className={
                        "h-11 rounded-full border-[1.5px] px-[18px] text-sm font-medium transition " +
                        (on
                          ? "border-[#5B4A38] bg-[#5B4A38] text-white"
                          : "border-[#CFC3B4] bg-white text-[#5B4A38] hover:border-[#5B4A38]")
                      }
                    >
                      {t.reasons[k]}
                    </button>
                  );
                })}
              </div>
              {reasonKey === "other" && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="ret_other" className={labelCls}>{t.otherLabel}</label>
                  <textarea
                    id="ret_other"
                    rows={3}
                    autoFocus
                    placeholder={t.otherPlaceholder}
                    value={reasonOther}
                    onChange={function (e) { setReasonOther(e.target.value); }}
                    className="min-h-[96px] w-full resize-y rounded-xl border-[1.5px] border-[#CFC3B4] px-4 py-3.5 text-base text-[#5B4A38] outline-none transition placeholder:text-[#9C8D7B] focus:border-[#5B4A38] focus:ring-2 focus:ring-[#5B4A38]/15"
                  />
                </div>
              )}
            </fieldset>

            <button type="submit" disabled={busy} className={primaryBtnCls}>
              {busy ? t.submitting : t.submit}
            </button>
          </form>

          {/* Sidebar (desktop) */}
          <aside className="hidden w-[340px] shrink-0 flex-col gap-4 lg:flex">
            <div className="rounded-[20px] bg-white p-6 shadow-[0_2px_4px_rgba(59,48,38,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-[#7A6A57]">{t.codeLabel}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#CFC3B4] bg-[#F5F3EF] px-2.5 py-0.5 text-xs font-semibold">
                  <CheckIcon size={12} />
                  {t.accepted}
                </span>
              </div>
              <div className="mt-2 font-mono text-[22px] font-semibold tracking-[0.08em]">{fullCode}</div>
              <button
                type="button"
                onClick={switchCode}
                className="inline-flex min-h-[44px] items-center text-sm font-semibold underline underline-offset-2"
              >
                {t.differentCode}
              </button>
            </div>

            <div className="rounded-[20px] bg-white p-6 shadow-[0_2px_4px_rgba(59,48,38,0.05)]">
              <h2 className="font-body mb-4 text-xl">{t.nextTitle}</h2>
              <ul className="flex flex-col gap-4 text-sm leading-relaxed text-[#7A6A57]">
                <li className="flex gap-3"><span className="shrink-0 text-[#5B4A38]"><ClockIcon /></span>{t.next1}</li>
                <li className="flex gap-3"><span className="shrink-0 text-[#5B4A38]"><MailIcon /></span>{t.next2}</li>
                <li className="flex gap-3"><span className="shrink-0 text-[#5B4A38]"><BoxIcon /></span>{t.next3}</li>
              </ul>
            </div>

            <a
              href={MESSENGER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3.5 rounded-[20px] bg-[#5B4A38] px-6 py-5 text-white transition hover:bg-[#4A3B2C]"
            >
              <ChatIcon size={22} />
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">{t.questionsTitle}</span>
                <span className="block text-sm text-[#E2D9CD]">{t.questionsSub}</span>
              </span>
              <ExternalIcon size={16} />
            </a>
          </aside>

          {/* Help link (phones and tablets) */}
          <a
            href={MESSENGER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-white/85 text-sm font-semibold lg:hidden"
          >
            <ChatIcon size={16} />
            {t.questions}
          </a>
        </div>
      </main>
    </div>
  );
}
