import { NextResponse } from "next/server";
import { createShipment, filterRates, buyShipment } from "@/lib/easypost";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Creates a USPS return label (customer -> boutique) for a return request
// and buys the cheapest USPS rate.
export async function POST(req: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { request_id, parcel } = await req.json();
    const admin = supabaseAdmin();

    const { data: rr, error } = await admin
      .from("return_requests")
      .select("*")
      .eq("id", request_id)
      .single();
    if (error || !rr) throw new Error("Return request not found");

    // is_return swaps direction: to_address = customer, EasyPost routes back to from_address.
    const shipment = await createShipment({
      to: {
        name: rr.from_name,
        street1: rr.from_street1,
        street2: rr.from_street2 || undefined,
        city: rr.from_city,
        state: rr.from_state,
        zip: rr.from_zip,
        country: rr.from_country || "US",
        phone: rr.from_phone || undefined,
        email: rr.from_email || undefined,
      },
      parcel: parcel || { length: 14, width: 17, height: 1, weight_lb: 1, weight_oz: 0 },
      isReturn: true,
    });

    const uspsRates = filterRates(shipment).filter((r: any) => r.carrier === "USPS");
    if (!uspsRates.length) throw new Error("No USPS rates returned for this address");

    const bought = await buyShipment(shipment.id, uspsRates[0].id);

    const update = {
      status: "label_created",
      easypost_shipment_id: bought.id,
      label_url: bought.postage_label?.label_url ?? null,
      tracking_number: bought.tracking_code ?? null,
      tracking_url: bought.tracker?.public_url ?? null,
      carrier: "USPS",
      mail_class: bought.selected_rate?.service ?? null,
      postage_amount: bought.selected_rate?.rate ? Number(bought.selected_rate.rate) : null,
    };
    const { error: upErr } = await admin.from("return_requests").update(update).eq("id", request_id);
    if (upErr) throw new Error(upErr.message);

    return NextResponse.json({ ok: true, ...update });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
