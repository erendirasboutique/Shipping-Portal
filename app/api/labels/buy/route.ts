import { NextResponse } from "next/server";
import { buyShipment } from "@/lib/easypost";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { order_id, shipment_id, rate_id } = await req.json();
    const bought = await buyShipment(shipment_id, rate_id);

    const update = {
      easypost_shipment_id: bought.id,
      easypost_tracker_id: bought.tracker?.id ?? null,
      label_url: bought.postage_label?.label_url ?? null,
      tracking_number: bought.tracking_code ?? null,
      tracking_url: bought.tracker?.public_url ?? null,
      carrier: bought.selected_rate?.carrier?.replace(/DAP|Default/g, "") ?? null,
      mail_class: bought.selected_rate?.service ?? null,
      postage_amount: bought.selected_rate?.rate ? Number(bought.selected_rate.rate) : null,
      postage_currency: bought.selected_rate?.currency ?? "USD",
      status: "purchased",
      print_status: "not_printed",
    };

    const admin = supabaseAdmin();
    const { error } = await admin.from("shipping_orders").update(update).eq("id", order_id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, ...update });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
