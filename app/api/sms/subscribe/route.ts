// app/api/sms/subscribe/route.ts
// Public (see middleware). The /sms sign-up form posts here.
// Saves the customer's consent (with the exact wording, time, IP and browser)
// and sends the welcome text if texting is set up.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendSms, smsConfigured, toE164 } from "@/lib/customerNotify";
import { SMS_CONSENT_EN, SMS_CONSENT_ES, SMS_WELCOME } from "@/lib/smsConsent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 120);
  const phone = toE164(String(body.phone || ""));
  if (body.website) return NextResponse.json({ ok: true }); // bots fill the hidden field
  if (!phone) return NextResponse.json({ error: "Escribe un número de celular de EE. UU. de 10 dígitos." }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: "Marca la casilla para aceptar los mensajes de texto." }, { status: 400 });

  const admin: any = supabaseAdmin();
  const { data: existing } = await admin.from("sms_subscribers").select("id, opted_in_at, opted_out_at").eq("phone", phone).maybeSingle();

  // Already signed up in the last 10 minutes: don't text them again.
  const recent = existing && !existing.opted_out_at && existing.opted_in_at && Date.now() - new Date(existing.opted_in_at).getTime() < 10 * 60000;

  const record = {
    phone,
    name: name || null,
    opted_in_at: new Date().toISOString(),
    opted_out_at: null,
    source: "web:/sms",
    consent_text: SMS_CONSENT_ES + " / " + SMS_CONSENT_EN,
    ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null,
    user_agent: (req.headers.get("user-agent") || "").slice(0, 300) || null,
  };
  const { error } = await admin.from("sms_subscribers").upsert(record, { onConflict: "phone" });
  if (error) {
    console.error("[sms/subscribe]", error.message);
    return NextResponse.json({ error: "No pudimos guardar tu número. Intenta de nuevo." }, { status: 500 });
  }

  if (!recent && smsConfigured()) {
    try {
      await sendSms(phone, SMS_WELCOME);
    } catch (e: any) {
      console.error("[sms/subscribe] welcome text failed", e?.message);
    }
  }
  return NextResponse.json({ ok: true });
}
