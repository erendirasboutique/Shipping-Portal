// app/api/muse/packages/[id]/flag/route.ts
// For Muse. Reports a package it couldn't send (no matching Messenger chat,
// more than one match, or the send failed). The portal flags it so staff
// can send it by hand.
//   POST {reason: "not_found" | "multiple_matches" | "send_failed" | "other", note?: string}
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { museAuthorized, museDenied } from "@/lib/museAuth";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REASONS: Record<string, string> = {
  not_found: "Couldn't find them on Messenger",
  multiple_matches: "More than one person with that name",
  send_failed: "Messenger didn't send",
  other: "Couldn't send",
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!museAuthorized(req)) return museDenied();
  if (!UUID.test(params.id)) return NextResponse.json({ error: "That isn't a package id." }, { status: 400 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  const key = String(body?.reason || "other").toLowerCase();
  const note = String(body?.note || "").trim().slice(0, 300);
  const text = (REASONS[key] || REASONS.other) + (note ? ": " + note : "");

  const admin = supabaseAdmin();
  const { data: order } = await admin
    .from("shipping_orders")
    .select("id, order_number, customer_notified_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Package not found." }, { status: 404 });
  if (order.customer_notified_at) {
    return NextResponse.json({ ok: true, already_sent: true, note: "This package was already sent; nothing was flagged." });
  }

  const { error } = await admin
    .from("shipping_orders")
    .update({ muse_status: "flagged", muse_flag_reason: text, muse_updated_at: new Date().toISOString() })
    .eq("id", order.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, flagged: true, order_number: order.order_number != null ? "EB-" + order.order_number : null, reason: text });
}
