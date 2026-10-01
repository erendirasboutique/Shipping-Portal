// app/api/packing/route.ts
// Staff only.
//   GET  ?since=ISO          → labels bought since then, with packed/sent status
//   POST {orderId, packed}   → mark an order packed (or not packed) by hand
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function staff() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  return user;
}

export async function GET(req: Request) {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sinceParam = new URL(req.url).searchParams.get("since");
  const since = sinceParam && !isNaN(Date.parse(sinceParam))
    ? new Date(sinceParam).toISOString()
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const base =
    "id, order_number, to_name, to_city, to_state, carrier, mail_class, tracking_number, status, refund_status, created_at, packed_at, packed_by, package_photo_url, customer_notified_at, notified_via";
  // Typed loosely: a column list built at runtime makes the Supabase type checker give up on Vercel.
  const fetchRows = (columns: string): any =>
    supabaseAdmin()
      .from("shipping_orders")
      .select(columns)
      .not("tracking_number", "is", null)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(1000);

  // Include the Muse queue status when that database update is in; otherwise carry on without it.
  let { data, error }: { data: any[] | null; error: any } = await fetchRows(base + ", muse_status, muse_flag_reason");
  if (error && /muse_/i.test(error.message)) ({ data, error } = await fetchRows(base));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Refunded / voided labels aren't going out, so they don't need packing.
  const orders = (data || []).filter(
    (o: any) => String(o.status || "").toLowerCase() !== "refunded" && !o.refund_status
  );
  return NextResponse.json({ orders });
}

export async function POST(req: Request) {
  const user = await staff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orderId, packed } = await req.json();
  if (!orderId) return NextResponse.json({ error: "Missing order." }, { status: 400 });

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin()
    .from("shipping_orders")
    .update(
      packed
        ? { packed_at: now, packed_by: user.email || null, updated_at: now }
        : { packed_at: null, packed_by: null, updated_at: now }
    )
    .eq("id", orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, packed_at: packed ? now : null, packed_by: packed ? user.email : null });
}
