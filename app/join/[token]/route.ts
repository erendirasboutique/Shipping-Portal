// Team invite links: ship.erendirasboutique.com/join/<token>
//
// GET only shows a "Continue" button. Link previews in Messages, Messenger,
// WhatsApp and email open links in the background; they never press it.
// POST (the tap) checks the invite and signs the person in right then.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { signInNow, type StaffRow } from "@/lib/team";

export const dynamic = "force-dynamic";

function page(body: string) {
  return new NextResponse(
    `<!doctype html>
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
  button:disabled{opacity:.6}
</style>
</head>
<body>${body}</body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}

const LOGO = `<img src="/EB_Logo_Fall%20BGBLANK.png" alt="Erendira's Boutique">`;

async function findInvite(token: string): Promise<StaffRow | null> {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const { data } = await supabaseAdmin()
    .from("staff_users")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();
  const row = data as StaffRow | null;
  if (!row || row.active === false) return null;
  if (row.invite_expires_at && new Date(row.invite_expires_at).getTime() < Date.now()) return null;
  return row;
}

function deadLink() {
  return page(`<div class="card">${LOGO}
    <h1>This link doesn't work anymore</h1>
    <p>It expired or a newer link was sent. Ask for a new invite.</p>
    <p style="margin-top:10px">Este enlace ya no sirve. Pide una invitación nueva.</p>
  </div>`);
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const row = await findInvite(params.token);
  if (!row) return deadLink();
  const first = (row.full_name || "").split(" ")[0].replace(/[<>&"']/g, "");
  return page(`<form class="card" method="POST" onsubmit="this.querySelector('button').disabled=true">
    ${LOGO}
    <h1>${first ? `Hi ${first}! · ¡Hola ${first}!` : "You're invited · Estás invitada"}</h1>
    <p>Tap the button to join the team.<br>Toca el botón para unirte al equipo.</p>
    <button type="submit">Continue · Continuar</button>
  </form>`);
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const { origin } = new URL(req.url);
  const row = await findInvite(params.token);
  if (!row) return NextResponse.redirect(`${origin}/join/${encodeURIComponent(params.token)}`, 303);

  const res = await signInNow(row.email);
  if ("error" in res) {
    console.error("Join failed for", row.email, res.error);
    return NextResponse.redirect(
      `${origin}/login?error=link_expired&why=${encodeURIComponent(res.error)}`,
      303
    );
  }

  // Used: clear it so the same link can't sign someone in twice.
  await supabaseAdmin()
    .from("staff_users")
    .update({ invite_token: null, invite_expires_at: null })
    .eq("id", row.id);

  return NextResponse.redirect(`${origin}/welcome`, 303);
}
