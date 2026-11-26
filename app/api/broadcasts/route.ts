// app/api/broadcasts/route.ts
// Staff only.
//   GET  -> how many people each audience reaches, the current live link, recent sends
//   POST -> { channels, audience, customerId?, message } creates a send and its recipient list.
//           The page then calls /api/broadcasts/[id]/send until it's done.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentLiveLink, resolveRecipients, type Audience, type Channels } from "@/lib/broadcast";
import { emailConfigured, smsConfigured } from "@/lib/customerNotify";
import { cleanMessage, staff } from "@/lib/broadcastApi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const AUDIENCES: Audience[] = ["sms_subscribers", "emails", "live_week"];

export async function GET() {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin: any = supabaseAdmin();
  const { error: tableErr } = await admin.from("broadcasts").select("id").limit(1);
  if (tableErr) {
    return NextResponse.json({ error: "Run supabase/broadcasts.sql in the Supabase SQL Editor first.", needsSetup: true }, { status: 400 });
  }
  const counts: Record<string, { email: number; sms: number }> = {};
  await Promise.all(
    AUDIENCES.map(async (a) => {
      const r = await resolveRecipients(a, "both");
      counts[a] = { email: r.filter((x) => x.channel === "email").length, sms: r.filter((x) => x.channel === "sms").length };
    })
  );
  const [{ data: recent }, liveLink] = await Promise.all([
    admin.from("broadcasts").select("id, channels, audience, message, status, total, sent, failed, created_at, created_by").order("created_at", { ascending: false }).limit(15),
    currentLiveLink(admin),
  ]);
  return NextResponse.json({ counts, liveLink, recent: recent || [], ready: { email: emailConfigured(), sms: smsConfigured() } });
}

export async function POST(req: Request) {
  const user = await staff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const channels = body.channels as Channels;
  const audience = body.audience as Audience;
  if (!["email", "sms", "both"].includes(channels)) return NextResponse.json({ error: "Pick Email, Text, or both." }, { status: 400 });
  if (![...AUDIENCES, "one"].includes(audience)) return NextResponse.json({ error: "Pick who to send to." }, { status: 400 });
  if (audience === "one" && !body.customerId) return NextResponse.json({ error: "Pick the customer." }, { status: 400 });
  const message = cleanMessage(body.message);
  if (channels !== "email" && !message.sms_body.trim()) return NextResponse.json({ error: "Write the text message." }, { status: 400 });
  if (channels !== "sms" && (!message.email_subject.trim() || !message.email_body.trim())) {
    return NextResponse.json({ error: "The email needs a subject and a message." }, { status: 400 });
  }
  if (/\[(HORA|Tu oferta aquí|Escribe aquí[^\]]*)\]/i.test(JSON.stringify(message))) {
    return NextResponse.json({ error: "Fill in the parts in [brackets] first." }, { status: 400 });
  }

  const recipients = await resolveRecipients(audience, channels, body.customerId || null);
  if (!recipients.length) {
    return NextResponse.json({ error: "Nobody to send to. (Texts only go to people who signed up; emails skip anyone who unsubscribed.)" }, { status: 400 });
  }

  const admin: any = supabaseAdmin();
  const { data: b, error } = await admin
    .from("broadcasts")
    .insert({ created_by: user.email || null, channels, audience, message, total: recipients.length })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  for (let i = 0; i < recipients.length; i += 500) {
    const rows = recipients.slice(i, i + 500).map((r) => ({ broadcast_id: b.id, channel: r.channel, to_addr: r.to, name: r.name }));
    const { error: rErr } = await admin.from("broadcast_recipients").insert(rows);
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: b.id, total: recipients.length });
}
