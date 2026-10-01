// app/api/muse/orders/route.ts
// For Muse. Look up a customer's recent shipments, e.g. when someone asks
// "¿dónde está mi paquete?".
//   GET ?q=<customer name, EB number, or tracking number>
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { museAuthorized, museDenied } from "@/lib/museAuth";
import { trackingLink } from "@/lib/notify";

export const dynamic = "force-dynamic";

const FIELDS =
  "id, order_number, to_name, to_city, to_state, carrier, mail_class, tracking_number, status, refund_status, created_at, package_photo_url, customer_notified_at";

export async function GET(req: Request) {
  if (!museAuthorized(req)) return museDenied();

  const raw = (new URL(req.url).searchParams.get("q") || "").trim();
  if (raw.length < 2) return NextResponse.json({ error: "Send at least 2 characters in q." }, { status: 400 });
  const admin = supabaseAdmin();

  let rows: any[] = [];
  const eb = raw.match(/^(?:EB[-\s]?)?(\d{1,6})$/i);
  if (eb) {
    const { data } = await admin.from("shipping_orders").select(FIELDS).eq("order_number", Number(eb[1])).limit(5);
    rows = data || [];
  }
  if (!rows.length && /^[0-9A-Z]{10,}$/i.test(raw.replace(/\s/g, ""))) {
    const { data } = await admin.from("shipping_orders").select(FIELDS).eq("tracking_number", raw.replace(/\s/g, "")).limit(5);
    rows = data || [];
  }
  if (!rows.length) {
    const safe = raw.replace(/[%_\\,()]/g, " ").trim();
    const { data } = await admin
      .from("shipping_orders")
      .select(FIELDS)
      .ilike("to_name", "%" + safe + "%")
      .not("tracking_number", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);
    rows = data || [];
  }

  return NextResponse.json({
    count: rows.length,
    orders: rows.map((o: any) => ({
      id: o.id,
      order_number: o.order_number != null ? "EB-" + o.order_number : null,
      customer_name: o.to_name,
      city: [o.to_city, o.to_state].filter(Boolean).join(", "),
      carrier: [o.carrier, o.mail_class].filter(Boolean).join(" "),
      tracking_number: o.tracking_number,
      tracking_link: o.tracking_number ? trackingLink(o.tracking_number) : null,
      label_bought: o.created_at,
      voided: String(o.status || "").toLowerCase() === "refunded" || !!o.refund_status,
      photo_url: o.package_photo_url,
      customer_already_messaged: !!o.customer_notified_at,
    })),
  });
}
