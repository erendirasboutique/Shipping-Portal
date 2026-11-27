// app/api/webhooks/resend-inbound/route.ts
//
// Resend "email.received" webhook. Payment emails (Venmo, PayPal, Cash App,
// Wells Fargo Zelle) are auto-forwarded from pay@shoperendirasboutique.com
// and hello@erendirasboutique.com to <anything>@corauxtro.resend.app.
// Resend calls this route; we read the email, pull out who paid, how much
// and the note, and save it as a payment waiting for someone to confirm on
// /pagos. Nothing here marks a basket paid.
//
// Public on purpose (under /api/webhooks, see middleware.ts). Every call
// must carry Resend's signature, checked with RESEND_INBOUND_WEBHOOK_SECRET.
//
// Env (Vercel):
//   RESEND_API_KEY                  already used for sending; also reads received emails
//   RESEND_INBOUND_WEBHOOK_SECRET   the webhook's signing secret from Resend (whsec_...)
//   INBOUND_PAYMENT_INBOXES         optional, default "pay@shoperendirasboutique.com,hello@erendirasboutique.com"

import { NextResponse } from "next/server";
import { liveDb } from "@/lib/live/supabase";
import {
  authStatus,
  forwardedBy,
  htmlToText,
  parsePaymentEmail,
  sourceFor,
  verifyResendSignature,
} from "@/lib/payments/inbound";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_INBOXES = "pay@shoperendirasboutique.com,hello@erendirasboutique.com";

async function fetchReceivedEmail(id: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails/receiving/" + encodeURIComponent(id), {
    headers: { Authorization: "Bearer " + key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Resend returned " + res.status + " for email " + id);
  return res.json();
}

export async function POST(req: Request) {
  const raw = await req.text();

  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET || "";
  if (!secret) {
    console.error("resend-inbound: RESEND_INBOUND_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  if (!verifyResendSignature(raw, req.headers, secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (event?.type !== "email.received") return NextResponse.json({ ok: true, skipped: "type" });

  const emailId: string | undefined = event?.data?.email_id;
  if (!emailId) return NextResponse.json({ ok: true, skipped: "no email id" });

  // Only the four payment senders (and Gmail's forwarding confirmation).
  const who = sourceFor(event?.data?.from);
  if (!who) return NextResponse.json({ ok: true, skipped: "not a payment sender" });

  const db = liveDb();

  // Resend may retry; one row per received email.
  const { data: seen } = await db.from("inbound_payments").select("id").eq("resend_email_id", emailId).maybeSingle();
  if (seen) return NextResponse.json({ ok: true, duplicate: true });

  let email: any;
  try {
    email = await fetchReceivedEmail(emailId);
  } catch (err: any) {
    console.error("resend-inbound fetch:", err?.message);
    // 500 so Resend tries again later.
    return NextResponse.json({ error: "could not read email" }, { status: 500 });
  }

  const subject = String(email?.subject || event?.data?.subject || "");
  const text = email?.text ? String(email.text) : htmlToText(String(email?.html || ""));
  const parsed = parsePaymentEmail(who.source, subject, text);
  const auth = authStatus(email?.authentication, who.domain);
  const inboxes = (process.env.INBOUND_PAYMENT_INBOXES || DEFAULT_INBOXES).split(",").map((s) => s.trim());
  const forwarder = forwardedBy(email?.headers, inboxes);

  // Says it's from Venmo/PayPal/... but the signature check failed: likely
  // a fake "you got paid" email. Keep it out of the list.
  if (auth === "fail") {
    console.warn("resend-inbound: rejected (auth fail)", who.source, emailId);
    return NextResponse.json({ ok: true, rejected: "auth" });
  }

  const row = {
    source: who.source,
    resend_email_id: emailId,
    forwarded_by: forwarder,
    auth_status: auth,
    payer_name: parsed.payerName,
    amount_cents: parsed.amountCents,
    // For Gmail's forwarding confirmation, keep the code where the screen can show it.
    note: who.source === "gmail_confirm" ? (parsed.code ? "Código: " + parsed.code : subject.slice(0, 160)) : parsed.note,
    reference: parsed.reference,
    paid_on: parsed.paidOn,
    subject: subject.slice(0, 200),
    status: "new",
  };

  const { error } = await db.from("inbound_payments").insert(row);
  if (error) {
    // Same transaction forwarded twice (unique source + reference): fine.
    if (/duplicate key|unique/i.test(error.message)) return NextResponse.json({ ok: true, duplicate: true });
    console.error("resend-inbound insert:", error.message);
    return NextResponse.json({ error: "could not save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
