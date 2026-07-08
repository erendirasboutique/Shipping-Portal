"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
  );
}

function LoginInner() {
  const params = useSearchParams();
  const notStaff = params.get("error") === "not_staff";
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const supabase = supabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-xl !rounded-[2rem] px-8 py-12 text-center sm:px-16">
        <Image
          src="/logo2.png"
          alt="Erendira's Boutique"
          width={220}
          height={100}
          className="mx-auto h-auto w-48"
          priority
        />
        <h1 className="mx-auto mt-8 max-w-[320px] text-6xl leading-[1.02]">
          Shipping Studio
        </h1>
        <p className="mt-6 text-[15px] text-ink/80">
          Sign in with your Erendira&apos;s Boutique Google account.
        </p>

        {notStaff && (
          <p className="mx-auto mt-5 max-w-sm rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            That Google account isn&apos;t part of Erendira&apos;s Boutique. Use your work account.
          </p>
        )}

        <button
          onClick={signIn}
          disabled={busy}
          className="mx-auto mt-6 flex w-full max-w-md items-center justify-center gap-3 rounded-2xl border border-taupe/30 bg-white px-6 py-4 text-[15px] text-ink transition-colors hover:bg-cream/60 disabled:opacity-60"
        >
          <GoogleG />
          {busy ? "Redirecting…" : "Continue with Google"}
        </button>
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
