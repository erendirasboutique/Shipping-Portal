import { NextResponse } from "next/server";
import { getProvider } from "@/lib/shipping";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { order_id, shipment_id, rate_id, provider: providerName } = await req.json();
    const admin = supabaseAdmin();

    const { data: order, error: loadErr } = await admin
      .from("shipping_orders").select("*").eq("id", order_id).single();
    if (loadErr || !order) throw new Error("Order not found — save the draft first");

    const provider = getProvider(providerName);
    const bought = await provider.buy({
      shipmentRef: shipment_id,
      rateId: rate_id,
      input: {
        to: {
          name: order.to_name, street1: order.to_street1, street2: order.to_street2 || undefined,
          city: order.to_city, state: order.to_state, zip: order.to_zip,
          country: order.to_country || "US", phone: order.to_phone || undefined,
          email: order.to_email || undefined,
        },
        parcel: {
          length: order.length, width: order.width, height: order.height,
          weight_lb: order.weight_lb, weight_oz: order.weight_oz,
        },
        signature: order.signature_confirmation,
      },
    });

    const update = {
      provider: providerName || "easypost",
      easypost_shipment_id: bought.shipmentRef,
      provider_transaction_id: bought.transactionRef,
      easypost_tracker_id: bought.trackerRef,
      label_url: bought.label_url,
      tracking_number: bought.tracking_number,
      tracking_url: bought.tracking_url,
      carrier: bought.carrier,
      mail_class: bought.service,
      postage_amount: bought.rate,
      postage_currency: bought.currency,
      status: "purchased",
      print_status: "not_printed",
    };

    const { error } = await admin.from("shipping_orders").update(update).eq("id", order_id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, ...update });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
