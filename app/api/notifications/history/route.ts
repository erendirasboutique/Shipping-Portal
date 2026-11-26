// app/api/notifications/history/route.ts
// Staff only. The last 150 notifications sent (or skipped / failed).
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin: any = supabaseAdmin();
  const { data, error } = await admin
    .from("notification_log")
    .select("id, order_id, stage, channel, sent_to, status, error, test, created_at, shipping_orders(order_number, to_name)")
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rows: data || [] });
}
