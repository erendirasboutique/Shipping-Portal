import { NextResponse } from "next/server";
import { getProvider } from "@/lib/shipping";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { order_id } = await req.json();
    const admin = supabaseAdmin();

    const { data: order, error: loadErr } = await admin
      .from("shipping_orders")
      .select("provider, easypost_shipment_id, provider_transaction_id")
      .eq("id", order_id).single();
    if (loadErr || !order) throw new Error("Order not found");

    const provider = getProvider(order.provider);
    const { refund_status } = await provider.refund({
      shipmentRef: order.easypost_shipment_id,
      transactionRef: order.provider_transaction_id,
    });

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
