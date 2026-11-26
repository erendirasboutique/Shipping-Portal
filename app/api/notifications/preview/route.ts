// app/api/notifications/preview/route.ts
// Staff only. Renders the email + text from what's on screen (not saved yet), with a made-up order.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, SAMPLE_VARS, STAGES, renderEmail, renderSms } from "@/lib/customerNotify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const t = body.template;
  if (!t || !STAGES.includes(t.stage)) return NextResponse.json({ error: "Pick a message." }, { status: 400 });
  const settings = { ...DEFAULT_SETTINGS, ...(body.settings || {}) };
  const email = renderEmail(t, settings, SAMPLE_VARS);
  return NextResponse.json({ subject: email.subject, html: email.html, sms: renderSms(t, SAMPLE_VARS) });
}
