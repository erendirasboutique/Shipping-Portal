"use client";

// Where a new employee lands after tapping their invite link. They pick a
// password for next time (or skip), then go to the employee start page (/e).

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { setPortalLocale, usePortalLocale } from "@/components/PortalTranslator";

const LOGO = "/EB_Logo_Fall BGBLANK.png";

const COPY = {
  en: {
    hi: (n: string) => (n ? `Welcome, ${n}!` : "Welcome!"),
    sub: "You're on the Erendira's Boutique team. Pick a password so you can sign in next time.",
    signin: "Next time you'll sign in with:",
    pw: "New password",
    pw2: "Type it again",
    show: "Show",
    hide: "Hide",
    save: "Save and continue",
    saving: "Saving…",
    skip: "Skip for now",
    google: "Using a Gmail? You can also tap “Continue with Google” on the sign-in page.",
    short: "Use at least 8 characters.",
    nomatch: "The passwords don't match.",
    lang: "Español",
    noSession: "This link already signed you out or expired. Ask for a new invite link.",
  },
  es: {
    hi: (n: string) => (n ? `¡Bienvenida, ${n}!` : "¡Bienvenida!"),
    sub: "Ya eres parte del equipo de Erendira's Boutique. Escoge una contraseña para entrar la próxima vez.",
    signin: "La próxima vez entrarás con:",
    pw: "Contraseña nueva",
    pw2: "Escríbela otra vez",
    show: "Ver",
    hide: "Ocultar",
    save: "Guardar y continuar",
    saving: "Guardando…",
    skip: "Saltar por ahora",
    google: "¿Usas Gmail? También puedes tocar “Continue with Google” en la página para entrar.",
    short: "Usa por lo menos 8 caracteres.",
    nomatch: "Las contraseñas no son iguales.",
    lang: "English",
    noSession: "Este enlace ya expiró. Pide un enlace de invitación nuevo.",
  },
};

export default function Welcome() {
  const router = useRouter();
  const locale = usePortalLocale();
  const t = COPY[locale];
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(async ({ data }) => {
      const e = data.user?.email ?? "";
      setEmail(e);
      if (e) {
        const { data: row } = await supabase
          .from("staff_users")
          .select("full_name")
          .eq("email", e.toLowerCase())
          .maybeSingle();
        const full = (row?.full_name as string | undefined) || (data.user?.user_metadata?.full_name as string | undefined) || "";
        setName(full.split(" ")[0] || "");
      }
      setReady(true);
    });
  }, []);

  async function save() {
    setError(null);
    if (pw.length < 8) return setError(t.short);
    if (pw !== pw2) return setError(t.nomatch);
    setBusy(true);
    const { error: err } = await supabaseBrowser().auth.updateUser({ password: pw });
    setBusy(false);
    if (err) return setError(err.message);
    router.push("/e");
  }

  return (
    <main
      translate="no"
      className="flex min-h-screen flex-col items-center justify-center bg-cream bg-cover bg-center px-4 py-10"
      style={{ backgroundImage: "url('/pattern_refined.svg')" }}
    >
      <div className="card w-full max-w-md !p-7 sm:!p-9">
        <div className="flex items-center justify-between gap-3">
          <Image src={LOGO} alt="Erendira's Boutique" width={170} height={72} className="h-10 w-auto" priority />
          <button onClick={() => setPortalLocale(locale === "es" ? "en" : "es")} className="btn-secondary !px-4 !py-2">
            {t.lang}
          </button>
        </div>

        {ready && !email ? (
          <p className="mt-8 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{t.noSession}</p>
        ) : (
          <>
            <h1 className="mt-8 text-3xl leading-tight">{t.hi(name)}</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">{t.sub}</p>

            <div className="mt-6 rounded-2xl bg-sand/20 px-4 py-3 text-sm">
              <span className="text-ink/60">{t.signin}</span>
              <div className="mt-0.5 break-all font-medium text-ink">{email || "…"}</div>
            </div>

            <form
              className="mt-5 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <label className="grid gap-1.5 text-sm">
                <span className="text-ink/70">{t.pw}</span>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    className="input !pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute inset-y-0 right-3 text-xs font-medium text-taupe"
                  >
                    {show ? t.hide : t.show}
                  </button>
                </div>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-ink/70">{t.pw2}</span>
                <input
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  className="input"
                />
              </label>

              {error && <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

              <button type="submit" disabled={busy || !email} className="btn-primary mt-1 h-12 w-full text-base">
                {busy ? t.saving : t.save}
              </button>
              <button type="button" onClick={() => router.push("/e")} className="text-sm text-taupe underline underline-offset-4">
                {t.skip}
              </button>
            </form>

            <p className="mt-6 text-xs leading-relaxed text-ink/55">{t.google}</p>
          </>
        )}
      </div>
    </main>
  );
}
