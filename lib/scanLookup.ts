// Server-only: find an order from a scanned barcode.
import type { SupabaseClient } from "@supabase/supabase-js";

const ORDER_FIELDS =
  "id, order_number, customer_id, to_name, to_city, to_state, to_zip, to_email, tracking_number, carrier, mail_class, status, package_photo_url, packed_at, customer_notified_at, notified_via";

// A USPS label barcode reads as "420" + ZIP (5 or 9 digits) + tracking.
// Other carriers put the tracking number in the barcode as-is, sometimes
// with extra digits in front. Build every reasonable guess.
export function trackingCandidates(raw: string): string[] {
  const code = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const out = new Set<string>();
  if (!code) return [];
  out.add(code);
  if (/^420\d{5}/.test(code)) {
    out.add(code.slice(8));
    if (/^420\d{9}/.test(code)) out.add(code.slice(12));
  }
  if (/^\d{26,}$/.test(code)) {
    out.add(code.slice(-22));
    out.add(code.slice(-26));
  }
  if (/^\d{30,}$/.test(code)) {
    out.add(code.slice(-12));
    out.add(code.slice(-15));
    out.add(code.slice(-20));
  }
  return Array.from(out).filter((c) => c.length >= 8);
}

export async function findOrderByCode(admin: SupabaseClient, raw: string) {
  const trimmed = raw.trim();

  // Typed order number: "EB-123", "eb123" or "123"
  const eb = trimmed.match(/^(?:EB[-\s]?)?(\d{1,6})$/i);
  if (eb) {
    const { data } = await admin.from("shipping_orders").select(ORDER_FIELDS).eq("order_number", Number(eb[1])).limit(1);
    if (data && data.length) return data[0];
  }

  const cands = trackingCandidates(trimmed);
  if (!cands.length) return null;

  const { data: exact } = await admin
    .from("shipping_orders")
    .select(ORDER_FIELDS)
    .in("tracking_number", cands)
    .order("created_at", { ascending: false })
    .limit(1);
  if (exact && exact.length) return exact[0];

  // Last resort: the scanned code contains a recent tracking number.
  const code = cands[0];
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("shipping_orders")
    .select(ORDER_FIELDS)
    .not("tracking_number", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);
  const hit = (recent || []).find((o: any) => {
    const t = String(o.tracking_number || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
    return t.length >= 10 && (code.endsWith(t) || code.includes(t) || t.endsWith(code));
  });
  return hit || null;
}

// The customer's email: from the order, or from their customer record.
export async function customerEmail(admin: SupabaseClient, order: any): Promise<string | null> {
  if (order.to_email && String(order.to_email).trim()) return String(order.to_email).trim();
  if (!order.customer_id) return null;
  const { data } = await admin.from("shipping_customers").select("email").eq("id", order.customer_id).maybeSingle();
  return (data?.email || "").trim() || null;
}

export function orderLabel(order: any) {
  return order.order_number != null ? "EB-" + order.order_number : "Order";
}
