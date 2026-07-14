"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

// Where the Admin tab goes. Change this when you decide (e.g. an admin dashboard).
const ADMIN_URL = "/admin";

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

function Storefront() {
  return (
    <svg viewBox="0 0 460 480" className="h-auto w-full" role="img" aria-label="Illustration of the Erendira's Boutique storefront">
      <rect x="30" y="40" width="400" height="420" rx="6" fill="#d8c9b4" stroke="#5c4a38" strokeWidth="3" />
      <rect x="18" y="28" width="424" height="26" rx="4" fill="#c4b096" stroke="#5c4a38" strokeWidth="3" />
      <rect x="60" y="80" width="96" height="100" fill="#cfa963" stroke="#5c4a38" strokeWidth="3" />
      <path d="M96 96 h24 l8 44 h-40 z" fill="#a68bc0" stroke="#5c4a38" strokeWidth="3" />
      <line x1="108" y1="84" x2="108" y2="96" stroke="#5c4a38" strokeWidth="3" />
      <rect x="182" y="80" width="96" height="100" fill="#cfa963" stroke="#5c4a38" strokeWidth="3" />
      <rect x="204" y="96" width="52" height="34" rx="3" fill="#e6d9f0" stroke="#5c4a38" strokeWidth="3" />
      <rect x="196" y="136" width="68" height="36" rx="3" fill="#cbb6df" stroke="#5c4a38" strokeWidth="3" />
      <rect x="304" y="80" width="96" height="100" fill="#cfa963" stroke="#5c4a38" strokeWidth="3" />
      <rect x="316" y="104" width="26" height="66" fill="#b98a45" stroke="#5c4a38" strokeWidth="3" />
      <rect x="348" y="92" width="40" height="52" fill="#b98a45" stroke="#5c4a38" strokeWidth="3" />
      <rect x="352" y="148" width="28" height="26" fill="#e3cf9f" stroke="#5c4a38" strokeWidth="3" />
      <rect x="18" y="196" width="424" height="24" rx="4" fill="#c4b096" stroke="#5c4a38" strokeWidth="3" />
      <g fill="none" stroke="#5c4a38" strokeWidth="3">
        <circle cx="78" cy="248" r="12" /><circle cx="78" cy="248" r="5" />
        <circle cx="154" cy="248" r="12" /><circle cx="154" cy="248" r="5" />
        <circle cx="230" cy="248" r="12" /><circle cx="230" cy="248" r="5" />
        <circle cx="306" cy="248" r="12" /><circle cx="306" cy="248" r="5" />
        <circle cx="382" cy="248" r="12" /><circle cx="382" cy="248" r="5" />
      </g>
      <rect x="18" y="274" width="424" height="24" rx="4" fill="#c4b096" stroke="#5c4a38" strokeWidth="3" />
      <rect x="58" y="322" width="92" height="86" fill="#cfa963" stroke="#5c4a38" strokeWidth="3" />
      <path d="M92 336 h28 l10 22 h-48 z" fill="#c4b096" stroke="#5c4a38" strokeWidth="3" />
      <circle cx="104" cy="364" r="9" fill="#fdf9f1" stroke="#5c4a38" strokeWidth="3" />
      <line x1="104" y1="322" x2="104" y2="336" stroke="#5c4a38" strokeWidth="3" />
      <rect x="58" y="420" width="64" height="100" fill="#cfa963" stroke="#5c4a38" strokeWidth="3" transform="translate(0 -78)" />
      <rect x="74" y="366" width="34" height="18" rx="9" fill="#8a7150" stroke="#5c4a38" strokeWidth="3" />
      <circle cx="84" cy="375" r="5" fill="#e3cf9f" />
      <rect x="170" y="310" width="230" height="150" fill="#cfa963" stroke="#5c4a38" strokeWidth="3" />
      <circle cx="216" cy="336" r="11" fill="#e6d9f0" stroke="#5c4a38" strokeWidth="3" />
      <circle cx="216" cy="336" r="4" fill="#a68bc0" />
      <rect x="202" y="350" width="30" height="26" fill="#b98a45" stroke="#5c4a38" strokeWidth="3" />
      <rect x="210" y="356" width="13" height="13" fill="#fdf9f1" stroke="#5c4a38" strokeWidth="2.5" />
      <rect x="194" y="380" width="46" height="40" fill="#b98a45" stroke="#5c4a38" strokeWidth="3" />
      <text x="330" y="384" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="30" fill="#4a3a2a">Erendira&#8217;s</text>
      <text x="352" y="412" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="17" fill="#5c4a38">boutique</text>
      <rect x="356" y="418" width="34" height="42" fill="#b98a45" stroke="#5c4a38" strokeWidth="3" />
      <rect x="364" y="428" width="14" height="12" fill="#fdf9f1" stroke="#5c4a38" strokeWidth="2.5" />
    </svg>
  );
}

function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();
  const notStaff = params.get("error") === "not_staff";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function signInGoogle() {
    setBusy("google");
    const supabase = supabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
        queryParams: { prompt: "select_account" },
      },
    });
  }

  async function signInPassword() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setBusy("password");
    const supabase = supabaseBrowser();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password,
    });
    setBusy(null);
    if (err) {
      setError(err.message === "Invalid login credentials" ? "Wrong email or password." : err.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-cream bg-cover bg-center bg-fixed px-4 py-10"
      style={{ backgroundImage: "url('/pattern_refined.svg')" }}
    >
      <div className="mb-6 flex rounded-full border border-taupe/30 bg-white p-1 shadow-sm">
        <button className="rounded-full bg-sand/60 px-6 py-2 text-sm font-medium text-ink">App</button>
        <button
          onClick={function () {
            router.push(ADMIN_URL);
          }}
          className="rounded-full px-6 py-2 text-sm text-ink/70 hover:text-taupe"
        >
          Admin
        </button>
      </div>

      <div className="grid w-full max-w-5xl items-stretch gap-8 lg:grid-cols-2">
        <div className="card flex flex-col justify-center !rounded-[1.5rem] border-2 !border-ink/70 bg-white px-8 py-10 shadow-[6px_6px_0_rgba(60,48,36,0.85)] sm:px-12">
          <Image
            src="/logo2.png"
            alt="Erendira&#8217;s Boutique"
            width={170}
            height={74}
            className="mx-auto h-auto w-36"
            priority
          />
          <h1 className="mt-5 text-center font-body text-3xl font-semibold !text-ink sm:text-4xl">
            Welcome Back to Erendira&#8217;s Boutique
          </h1>

          {notStaff && (
            <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
              That account isn&#8217;t part of Erendira&#8217;s Boutique. Use your work account.
            </p>
          )}
          {error && (
            <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">{error}</p>
          )}
          {note && (
            <p className="mt-5 rounded-2xl bg-cream px-4 py-3 text-center text-sm text-taupe">{note}</p>
          )}

          <div className="mt-7 space-y-3">
            <input
              className="input !rounded-2xl !border-ink/50 !py-3.5"
              placeholder="Email"
              type="email"
              value={email}
              onChange={function (e) {
                setEmail(e.target.value);
              }}
            />
            <div className="relative">
              <input
                className="input !rounded-2xl !border-ink/50 !py-3.5 pr-12"
                placeholder="Password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={function (e) {
                  setPassword(e.target.value);
                }}
                onKeyDown={function (e) {
                  if (e.key === "Enter") signInPassword();
                }}
              />
              <button
                type="button"
                aria-label={showPw ? "Hide password" : "Show password"}
                onClick={function () {
                  setShowPw(!showPw);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/50 hover:text-ink"
              >
                {showPw ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18M10.5 10.7a2.5 2.5 0 003.3 3.3M7.4 7.5C4.9 9 3 12 3 12s3.5 6 9 6c1.6 0 3-.4 4.2-1M12 6c5.5 0 9 6 9 6s-.7 1.2-2 2.5" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="2.5" /></svg>
                )}
              </button>
            </div>
            <div className="text-right">
              <button
                onClick={function () {
                  setNote("Ask an admin to reset your password.");
                }}
                className="text-sm text-ink/70 underline underline-offset-2 hover:text-taupe"
              >
                Forgot password
              </button>
            </div>
          </div>

          <button
            onClick={signInPassword}
            disabled={busy !== null}
            className="mt-4 w-full rounded-2xl bg-[#4a3a2a] py-4 text-[15px] font-medium text-cream transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy === "password" ? "Signing in..." : "Log in"}
          </button>

          <button
            onClick={signInGoogle}
            disabled={busy !== null}
            className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl border border-ink/50 bg-white py-4 text-[15px] text-ink transition-colors hover:bg-cream/60 disabled:opacity-60"
          >
            <GoogleG />
            {busy === "google" ? "Redirecting..." : "Continue with Google"}
          </button>

          <p className="mt-5 text-center text-sm text-ink/70">
            Staff access only &middot; need an account? Ask an admin.
          </p>
        </div>

        <div className="hidden items-center justify-center lg:flex">
          <div className="w-full rounded-[1.75rem] border-2 border-ink/60 bg-cream/80 p-10 shadow-[6px_6px_0_rgba(60,48,36,0.85)] backdrop-blur-sm">
            <Storefront />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
