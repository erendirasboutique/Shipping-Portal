// app/api/muse/packages/route.ts
// For Muse. Packages that were scanned and photographed, with everything
// needed to message the customer on Messenger.
//   GET ?status=queued (default: tapped "Send with Muse") | to_send (any photographed, not sent)
//          | flagged | sent | all   &days=7 (how far back, max 60)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { museAuthorized, museDenied } from "@/lib/museAuth";
import { packageMessage, trackingLink } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!museAuthorized(req)) return museDenied();

  const params = new URL(req.url).searchParams;
  const status = (params.get("status") || "queued").toLowerCase();
  const days = Math.min(60, Math.max(1, Number(params.get("days")) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Typed loosely on purpose: adding filters step by step makes the
  // Supabase type checker loop forever ("excessively deep") on Vercel.
  let q: any = supabaseAdmin()
    .from("shipping_orders")
    .select(
      "id, order_number, to_name, to_city, to_state, carrier, mail_class, tracking_number, status, refund_status, package_photo_url, packed_at, customer_notified_at, notified_via, muse_status, muse_flag_reason, muse_queued_at"
    )
    .not("package_photo_url", "is", null)
    .not("tracking_number", "is", null)
    .gte("packed_at", since)
    .order("packed_at", { ascending: true })
    .limit(500);
  if (status === "queued") q = q.eq("muse_status", "queued").is("customer_notified_at", null);
  if (status === "flagged") q = q.eq("muse_status", "flagged").is("customer_notified_at", null);
  if (status === "to_send") q = q.is("customer_notified_at", null);
  if (status === "sent") q = q.not("customer_notified_at", "is", null);

  const { data, error } = await q;
  if (error) {
    const msg = /muse_/i.test(error.message)
      ? "The portal needs its Muse database update (supabase/muse_queue.sql)."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const packages = (data || [])
    .filter((o: any) => String(o.status || "").toLowerCase() !== "refunded" && !o.refund_status)
    .map((o: any) => ({
      id: o.id,
      order_number: o.order_number != null ? "EB-" + o.order_number : null,
      customer_name: o.to_name,
      city: [o.to_city, o.to_state].filter(Boolean).join(", "),
      carrier: [o.carrier, o.mail_class].filter(Boolean).join(" "),
      tracking_number: o.tracking_number,
      tracking_link: trackingLink(o.tracking_number),
      photo_url: o.package_photo_url,
      message: packageMessage(o.to_name, o.tracking_number),
      packed_at: o.packed_at,
      already_sent: !!o.customer_notified_at,
      sent_at: o.customer_notified_at,
      sent_via: o.notified_via,
      muse_status: o.muse_status,
      flag_reason: o.muse_flag_reason,
      queued_at: o.muse_queued_at,
    }));

  return NextResponse.json({
    count: packages.length,
    instructions:
      "The business owner already approved every package in the queued list by tapping 'Send with Muse'. For each package: " +
      "search Messenger for a chat whose name matches customer_name. If exactly one chat matches, send the photo_url image, then the message text exactly as given, " +
      "then POST /api/muse/packages/{id}/sent. If no chat matches, more than one matches, or sending fails, do NOT send anything for that package; " +
      "POST /api/muse/packages/{id}/flag with reason not_found, multiple_matches, or send_failed, then move on to the next package. Never guess.",
    packages,
  });
}
