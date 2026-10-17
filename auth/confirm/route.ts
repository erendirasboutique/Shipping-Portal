// Invite / sign-in links from the Team page land here.
//
// GET only shows a "Continue" button. The one-time token is used on POST,
// when the person taps it. This matters: Messages, Messenger, WhatsApp and
// email apps open links in the background to build a preview, and if GET
// used the token, the preview would burn the link before the person taps it.

import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/team";

export const dynamic = "force-dynamic";

const TYPES: EmailOtpType[] = ["invite", "email", "magiclink", "signup", "recovery"];

function safeNext(raw: string | null) {
  const n = raw || "/welcome";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/welcome";
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash") || "";
  const type = searchParams.get("type") || "";
  const next = safeNext(searchParams.get("next"));

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Erendira's Boutique · Team invite</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F5F3EF;font-family:Georgia,serif;color:#3c3024;padding:16px;box-sizing:border-box}
  .card{background:#fff;border:1px solid #D9CFC1;border-radius:24px;padding:32px 28px;max-width:400px;width:100%;text-align:center;box-shadow:0 2px 16px rgba(90,74,58,.14)}
  img{height:44px;width:auto}
  h1{font-size:24px;margin:20px 0 6px}
  p{margin:0;color:#6b5d4f;font-size:15px;line-height:1.5}
  button{margin-top:24px;width:100%;height:52px;border:0;border-radius:999px;background:#8B7D6B;color:#F5F3EF;font:600 17px Georgia,serif;cursor:pointer}
  button:active{opacity:.85}
</style>
</head>
<body>
  <form class="card" method="POST" action="/auth/confirm">
    <img src="/EB_Logo_Fall%20BGBLANK.png" alt="Erendira's Boutique">
    <h1>You're invited · Estás invitada</h1>
    <p>Tap the button to join the team.<br>Toca el botón para unirte al equipo.</p>
    <input type="hidden" name="token_hash" value="${esc(tokenHash)}">
    <input type="hidden" name="type" value="${esc(type)}">
    <input type="hidden" name="next" value="${esc(next)}">
    <button type="submit">Continue · Continuar</button>
  </form>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const tokenHash = String(form?.get("token_hash") || "");
  const type = String(form?.get("type") || "") as EmailOtpType;
  const next = safeNext(String(form?.get("next") || ""));

  if (!tokenHash || !TYPES.includes(type)) {
    return NextResponse.redirect(`${origin}/login?error=link_expired`, 303);
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) {
    console.error("Invite link failed:", error?.message);
    return NextResponse.redirect(`${origin}/login?error=link_expired`, 303);
  }

  if (!(await isAllowed(data.user.email))) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_staff`, 303);
  }

  return NextResponse.redirect(`${origin}${next}`, 303);
}
