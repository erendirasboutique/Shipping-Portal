import { NextResponse } from "next/server";
import { refundShipment } from "@/lib/easypost";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { order_id, shipment_id } = await req.json();
    const refunded = await refundShipment(shipment_id);
    const refund_status = refunded.refund_status || "submitted";

    const admin = supabaseAdmin();
    const { error } = await admin
      .from("shipping_orders")
      .update({ refund_status, status: "refunded" })
      .eq("id", order_id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, refund_status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
