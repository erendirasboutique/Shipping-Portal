"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const TAUPE = "#806a52";

type Lang = "en" | "es";

const T = {
  en: {
    eyebrow: "Returns portal",
    title: "Start Your Return",
    headerSub: "Enter the return access code provided by Erendira's Boutique.",
    accessEyebrow: "Return access",
    enterCode: "Enter your return code",
    enterCodeSub: "Use the access code provided by Erendira's Boutique to start your return request.",
    missingCode: "Enter your return access code.",
    notFound: "That return code wasn't found.",
    genericError: "Something went wrong. Try again.",
    alreadyUsed1: "This code has already been used to start a return.",
    alreadyUsedLink: "Check your return status",
    alreadyUsed2: "to see or print your label.",
    accessCode: "Access code",
    codePlaceholder: "Example: EB-XXXXXX",
    checking: "Checking...",
    unlock: "Unlock Return Form",
    alreadySubmitted: "Already submitted a return?",
    checkStatus: "Check your return status",
    whereShipping: "Where are you shipping from?",
    codeAccepted: (code: string) => (
      <>
        Code <span className="font-mono tracking-widest text-taupe">{code}</span> accepted. Fill in
        your pickup address and we&apos;ll prepare your prepaid USPS label.
      </>
    ),
    fullName: "Full name",
    street: "Street address",
    apt: "Apt / Suite (optional)",
    city: "City",
    state: "State",
    zip: "ZIP",
    email: "Email",
    phone: "Phone (optional)",
    reason: "Reason for return (optional)",
    submitting: "Submitting...",
    submit: "Submit Return Request",
    differentCode: "Use a different code",
    received: "Request received",
    receivedMsg: (name: string) =>
      `Thanks, ${name}! We've received your return request. Once your prepaid USPS label is ready, come back and print it with your return code:`,
    checkReturnStatus: "Check Return Status",
    footerTitle: "Erendira's Boutique · Returns Portal",
    footerSub: "For questions, please contact us through our boutique support channels.",
  },
  es: {
    eyebrow: "Portal de devoluciones",
    title: "Inicia tu Devolución",
    headerSub: "Ingresa el código de acceso proporcionado por Erendira's Boutique.",
    accessEyebrow: "Acceso de devolución",
    enterCode: "Ingresa tu código de devolución",
    enterCodeSub:
      "Usa el código de acceso proporcionado por Erendira's Boutique para iniciar tu solicitud de devolución.",
    missingCode: "Ingresa tu código de acceso.",
    notFound: "No se encontró ese código de devolución.",
    genericError: "Algo salió mal. Inténtalo de nuevo.",
    alreadyUsed1: "Este código ya se usó para iniciar una devolución.",
    alreadyUsedLink: "Consulta el estado de tu devolución",
    alreadyUsed2: "para ver o imprimir tu etiqueta.",
    accessCode: "Código de acceso",
    codePlaceholder: "Ejemplo: EB-XXXXXX",
    checking: "Verificando...",
    unlock: "Desbloquear Formulario",
    alreadySubmitted: "¿Ya enviaste una devolución?",
    checkStatus: "Consulta el estado de tu devolución",
    whereShipping: "¿Desde dónde harás el envío?",
    codeAccepted: (code: string) => (
      <>
        Código <span className="font-mono tracking-widest text-taupe">{code}</span> aceptado.
        Completa tu dirección y prepararemos tu etiqueta prepagada de USPS.
      </>
    ),
    fullName: "Nombre completo",
    street: "Dirección",
    apt: "Apto / Suite (opcional)",
    city: "Ciudad",
    state: "Estado",
    zip: "Código postal",
    email: "Correo electrónico",
    phone: "Teléfono (opcional)",
    reason: "Motivo de la devolución (opcional)",
    submitting: "Enviando...",
    submit: "Enviar Solicitud de Devolución",
    differentCode: "Usar otro código",
    received: "Solicitud recibida",
    receivedMsg: (name: string) =>
      `¡Gracias, ${name}! Recibimos tu solicitud de devolución. Cuando tu etiqueta prepagada de USPS esté lista, vuelve e imprímela con tu código de devolución:`,
    checkReturnStatus: "Ver Estado de Devolución",
    footerTitle: "Erendira's Boutique · Portal de Devoluciones",
    footerSub: "Si tienes preguntas, contáctanos a través de nuestros canales de atención.",
  },
};

const emptyForm = {
  name: "", street1: "", street2: "",
  city: "", state: "", zip: "", phone: "", email: "", reason: "",
};

function Flower({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <ellipse cx="20" cy="11" rx="6" ry="9" fill="currentColor" />
      <ellipse cx="20" cy="11" rx="6" ry="9" fill="currentColor" transform="rotate(90 20 20)" />
      <ellipse cx="20" cy="11" rx="6" ry="9" fill="currentColor" transform="rotate(180 20 20)" />
      <ellipse cx="20" cy="11" rx="6" ry="9" fill="currentColor" transform="rotate(270 20 20)" />
      <circle cx="20" cy="20" r="4" fill="currentColor" />
    </svg>
  );
}

export default function PublicReturnPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [stage, setStage] = useState<"code" | "form" | "done">("code");
  const [code, setCode] = useState("");
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyUsed, setAlreadyUsed] = useState(false);

  const t = T[lang];

  function set(key: string, value: string) {
    setForm(function (f) {
      return { ...f, [key]: value };
    });
  }

  async function unlock() {
    const c = code.trim().toUpperCase();
    if (!c) {
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
        body: JSON.stringify({ code: c }),
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/returns/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, code: code.trim().toUpperCase() }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || t.genericError);
      setStage("done");
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] px-4 py-10">
      {/* background flowers */}
      <Flower className="pointer-events-none absolute -left-8 top-40 w-32 text-sand/30" />
      <Flower className="pointer-events-none absolute -right-6 -top-6 w-24 text-sand/25" />
      <Flower className="pointer-events-none absolute -bottom-8 right-24 w-36 text-sand/25" />
      <Flower className="pointer-events-none absolute bottom-24 -right-10 w-24 text-sand/20" />

      <div className="relative mx-auto w-full max-w-3xl">
        {/* Header card */}
        <div className="card relative flex flex-wrap items-center gap-6 !rounded-[1.75rem] border-l-[6px] !border-l-taupe !p-8">
          <div className="absolute right-5 top-5 flex overflow-hidden rounded-full border" style={{ borderColor: "#D8CDBD" }}>
            <button
              onClick={function () { setLang("en"); }}
              className="px-3 py-1 text-[11px] tracking-wide"
              style={lang === "en" ? { background: TAUPE, color: "#F5F3EF" } : { background: "#fff", color: TAUPE }}
            >
              EN
            </button>
            <button
              onClick={function () { setLang("es"); }}
              className="px-3 py-1 text-[11px] tracking-wide"
              style={lang === "es" ? { background: TAUPE, color: "#F5F3EF" } : { background: "#fff", color: TAUPE }}
            >
              ES
            </button>
          </div>

          <Image
            src="/EB_Logo_Fall BGBLANK.png"
            alt="Erendira&apos;s Boutique"
            width={190}
            height={82}
            className="h-auto w-40"
            priority
          />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{t.eyebrow}</p>
            <h1 className="mt-1 font-body text-4xl font-semibold !text-taupe sm:text-5xl">
              {t.title}
            </h1>
            <p className="mt-2 text-sm text-ink/70">{t.headerSub}</p>
          </div>
        </div>

        {/* Body card */}
        <div className="card mt-6 !rounded-[1.75rem] !p-8">
          {stage === "code" && (
            <>
              <p className="eyebrow">{t.accessEyebrow}</p>
              <h2 className="mt-1 font-body text-2xl font-semibold !text-taupe">
                {t.enterCode}
              </h2>
              <p className="mt-1 text-sm text-ink/70">{t.enterCodeSub}</p>

              {error && (
                <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              )}
              {alreadyUsed && (
                <div className="mt-5 rounded-2xl border border-taupe/30 bg-cream px-4 py-4 text-sm text-ink/80">
                  {t.alreadyUsed1}{" "}
                  <Link href="/return/status" className="font-medium text-taupe underline underline-offset-2">
                    {t.alreadyUsedLink}
                  </Link>{" "}
                  {t.alreadyUsed2}
                </div>
              )}

              <div className="mt-6">
                <label className="label">{t.accessCode}</label>
                <input
                  className="input !py-3.5 font-mono uppercase tracking-[0.2em]"
                  placeholder={t.codePlaceholder}
                  value={code}
                  onChange={function (e) {
                    setCode(e.target.value.toUpperCase());
                  }}
                  onKeyDown={function (e) {
                    if (e.key === "Enter") unlock();
                  }}
                />
              </div>

              <button onClick={unlock} disabled={busy} className="btn-primary mt-5 w-full !py-4 !text-sm">
                {busy ? t.checking : t.unlock}
              </button>

              <p className="mt-5 text-center text-xs text-ink/60">
                {t.alreadySubmitted}{" "}
                <Link href="/return/status" className="text-taupe underline underline-offset-2">
                  {t.checkStatus}
                </Link>
              </p>
            </>
          )}

          {stage === "form" && (
            <>
              <p className="eyebrow">{t.accessEyebrow}</p>
              <h2 className="mt-1 font-body text-2xl font-semibold !text-taupe">
                {t.whereShipping}
              </h2>
              <p className="mt-1 text-sm text-ink/70">{t.codeAccepted(code)}</p>

              {error && (
                <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              )}

              <div className="mt-6 grid gap-3">
                <div>
                  <label className="label">{t.fullName}</label>
                  <input className="input" value={form.name} onChange={function (e) { set("name", e.target.value); }} />
                </div>
                <div>
                  <label className="label">{t.street}</label>
                  <input className="input" value={form.street1} onChange={function (e) { set("street1", e.target.value); }} />
                </div>
                <div>
                  <label className="label">{t.apt}</label>
                  <input className="input" value={form.street2} onChange={function (e) { set("street2", e.target.value); }} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">{t.city}</label>
                    <input className="input" value={form.city} onChange={function (e) { set("city", e.target.value); }} />
                  </div>
                  <div>
                    <label className="label">{t.state}</label>
                    <input className="input" maxLength={2} value={form.state} onChange={function (e) { set("state", e.target.value.toUpperCase()); }} />
                  </div>
                  <div>
                    <label className="label">{t.zip}</label>
                    <input className="input" value={form.zip} onChange={function (e) { set("zip", e.target.value); }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{t.email}</label>
                    <input className="input" value={form.email} onChange={function (e) { set("email", e.target.value); }} />
                  </div>
                  <div>
                    <label className="label">{t.phone}</label>
                    <input className="input" value={form.phone} onChange={function (e) { set("phone", e.target.value); }} />
                  </div>
                </div>
                <div>
                  <label className="label">{t.reason}</label>
                  <textarea className="input" rows={3} value={form.reason} onChange={function (e) { set("reason", e.target.value); }} />
                </div>
              </div>

              <button onClick={submit} disabled={busy} className="btn-primary mt-6 w-full !py-4 !text-sm">
                {busy ? t.submitting : t.submit}
              </button>
              <button
                onClick={function () { setStage("code"); setError(null); }}
                className="mt-3 w-full text-center text-xs text-ink/60 underline underline-offset-2"
              >
                {t.differentCode}
              </button>
            </>
          )}

          {stage === "done" && (
            <div className="text-center">
              <p className="eyebrow">{t.accessEyebrow}</p>
              <h2 className="mt-1 font-body text-3xl font-semibold !text-taupe">{t.received}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink/70">
                {t.receivedMsg(form.name.split(" ")[0])}
              </p>
              <p className="mt-3 font-mono text-lg tracking-[0.25em] text-taupe">{code}</p>
              <Link href="/return/status" className="btn-primary mt-5 inline-flex">
                {t.checkReturnStatus}
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-taupe/30 pt-5 text-center">
          <p className="text-sm font-medium text-ink/80">{t.footerTitle}</p>
          <p className="mt-1 text-xs text-ink/60">{t.footerSub}</p>
        </div>
      </div>
    </div>
  );
}
