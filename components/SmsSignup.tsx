"use client";

// The /sms sign-up form. The consent box starts unchecked (carriers require it).
import { useState } from "react";
import { SMS_CONSENT_EN, SMS_CONSENT_ES } from "@/lib/smsConsent";

export default function SmsSignup() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // hidden bot trap
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) return setError("Marca la casilla para aceptar los mensajes de texto.");
    setBusy(true);
    const res = await fetch("/api/sms/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, consent, website }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data?.error || "Algo salió mal. Intenta de nuevo.");
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-taupe/20 bg-white p-8 text-center">
        <h2 className="font-heading text-3xl text-taupe">¡Listo, te suscribiste!</h2>
        <p className="mt-3 text-base leading-relaxed text-ink/80">
          Te mandaremos un mensaje de bienvenida. Para dejar de recibir mensajes, responde STOP en cualquier momento.
        </p>
        <p className="mt-2 text-sm text-ink/60">You&rsquo;re signed up! Reply STOP any time to opt out.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-3xl border border-taupe/20 bg-white p-6 sm:p-8">
      <div>
        <label htmlFor="sms-name" className="label">
          Nombre
        </label>
        <input id="sms-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Naranjo" />
      </div>
      <div>
        <label htmlFor="sms-phone" className="label">
          Número de celular
        </label>
        <input
          id="sms-phone"
          className="input"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(714) 555-0123"
        />
      </div>
      {/* Hidden from people; bots fill it in. */}
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      <label className="flex items-start gap-3 text-sm leading-relaxed text-ink/85">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#957f67]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          {SMS_CONSENT_ES}
          <span className="mt-2 block text-xs text-ink/60">{SMS_CONSENT_EN}</span>
        </span>
      </label>

      {error && <p className="text-sm text-red-800">{error}</p>}

      <button type="submit" className="btn-primary min-h-[48px] text-base" disabled={busy}>
        {busy ? "Guardando…" : "Suscribirme"}
      </button>

      <p className="text-center text-xs leading-relaxed text-ink/60">
        Al suscribirte aceptas nuestros{" "}
        <a href="/sms/terms" className="underline">
          Términos de mensajes de texto
        </a>{" "}
        y nuestra{" "}
        <a href="/sms/privacy" className="underline">
          Política de privacidad
        </a>
        .
      </p>
    </form>
  );
}
