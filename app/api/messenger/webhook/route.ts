// app/api/messenger/webhook/route.ts
// Facebook calls this whenever someone messages the business Page.
// It remembers who wrote and when, which is what opens the 24-hour window
// for sending them their package photo automatically.
//
// Public route (see middleware). Every POST is checked against FB_APP_SECRET.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validSignature, profileName } from "@/lib/messenger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Facebook's one-time check when the webhook is added.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  if (
    p.get("hub.mode") === "subscribe" &&
    process.env.FB_VERIFY_TOKEN &&
    p.get("hub.verify_token") === process.env.FB_VERIFY_TOKEN
  ) {
    return new Response(p.get("hub.challenge") || "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("Bad signature", { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (body?.object !== "page") return NextResponse.json({ ok: true });

  // Latest message time per sender in this batch.
  const latest = new Map<string, number>();
  const pageIds = new Set<string>((body.entry || []).map((e: any) => String(e.id)));
  for (const entry of body.entry || []) {
    for (const ev of entry.messaging || []) {
      const psid = ev?.sender?.id ? String(ev.sender.id) : "";
      if (!psid || pageIds.has(psid)) continue; // skip the Page's own echoes
      if (ev.message?.is_echo) continue;
      // Messages, button taps and reactions all open the window.
      if (!ev.message && !ev.postback && !ev.reaction) continue;
      const t = Number(ev.timestamp) || Date.now();
      latest.set(psid, Math.max(latest.get(psid) || 0, t));
    }
  }
  if (!latest.size) return NextResponse.json({ ok: true });

  // Loosely typed: long Supabase chains can trip Vercel's type check.
  const admin: any = supabaseAdmin();
  for (const [psid, ts] of Array.from(latest.entries())) {
    try {
      await recordInbound(admin, psid, new Date(ts).toISOString());
    } catch (e) {
      console.error("messenger webhook", psid, e);
    }
  }
  // Always 200, or Facebook retries and eventually turns the webhook off.
  return NextResponse.json({ ok: true });
}

async function recordInbound(admin: any, psid: string, at: string) {
  const { data: existing } = await admin
    .from("messenger_contacts")
    .select("psid, name, customer_id")
    .eq("psid", psid)
    .maybeSingle();

  const name: string | null = (existing?.name as string | null) || (await profileName(psid));

  // Already linked to a customer: just move their window forward.
  const { data: linked } = await admin
    .from("shipping_customers")
    .select("id")
    .eq("messenger_psid", psid)
    .maybeSingle();
  let customerId: string | null = linked?.id || null;

  // Not linked yet: link only when exactly one active customer has that
  // exact name and isn't linked to someone else. Otherwise staff pick.
  if (!customerId && name) {
    const exact = name.replace(/[\\%_]/g, (c: string) => "\\" + c);
    const { data: matches } = await admin
      .from("shipping_customers")
      .select("id, messenger_psid")
      .eq("archived", false)
      .is("merged_into", null)
      .ilike("name", exact)
      .limit(2);
    if (matches && matches.length === 1 && !matches[0].messenger_psid) {
      customerId = matches[0].id;
      await admin.from("shipping_customers").update({ messenger_psid: psid }).eq("id", customerId);
    }
  }

  if (customerId) {
    await admin
      .from("shipping_customers")
      .update({ messenger_last_inbound_at: at })
      .eq("id", customerId);
  }

  await admin.from("messenger_contacts").upsert({
    psid,
    name,
    last_inbound_at: at,
    customer_id: customerId,
    updated_at: new Date().toISOString(),
  });
}
