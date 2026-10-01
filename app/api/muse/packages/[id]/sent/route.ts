// app/api/muse/packages/[id]/sent/route.ts
// For Muse. Records that the customer was messaged, so the package
// drops off the "to send" list and the portal shows it as sent.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { museAuthorized, museDenied } from "@/lib/museAuth";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!museAuthorized(req)) return museDenied();
  if (!UUID.test(params.id)) return NextResponse.json({ error: "That isn't a package id." }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: order } = await admin
    .from("shipping_orders")
    .select("id, order_number, customer_notified_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Package not found." }, { status: 404 });
  if (order.customer_notified_at) {
    return NextResponse.json({ ok: true, already_sent: true, sent_at: order.customer_notified_at });
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("shipping_orders")
    .update({ customer_notified_at: now, notified_via: "messenger (Muse)" })
    .eq("id", order.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, order_number: order.order_number != null ? "EB-" + order.order_number : null, sent_at: now });
}
