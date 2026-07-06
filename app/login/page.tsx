"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

function LoginInner() {
  const params = useSearchParams();
  const notStaff = params.get("error") === "not_staff";

  async function signIn() {
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
      <div className="card w-full max-w-md text-center">
        <Image src="/logo2.png" alt="Erendira's Boutique" width={88} height={88} className="mx-auto rounded-full" />
        <h1 className="mt-5 text-3xl">Erendira Shipping Studio</h1>
        <p className="mt-2 text-sm text-taupe/80">Staff access only</p>
        {notStaff && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            That Google account isn&apos;t on the staff list. Ask an admin to add you.
          </p>
        )}
        <button onClick={signIn} className="btn-primary mt-6 w-full">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path fill="currentColor" d="M21.35 11.1H12v2.9h5.3c-.5 2.5-2.6 4-5.3 4a5.9 5.9 0 1 1 0-11.8c1.5 0 2.8.5 3.9 1.4l2.1-2.1A9 9 0 1 0 12 21c5.2 0 8.7-3.7 8.7-8.9 0-.3 0-.7-.1-1z"/>
          </svg>
          Sign in with Google
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
