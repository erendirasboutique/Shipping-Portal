import { NextResponse } from "next/server";
import { getProvider } from "@/lib/shipping";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Buys a return label (customer -> boutique).
// - If `rate_id` + `shipment_ref` are provided (from /api/returns/rates), buys that
//   exact rate — USPS, FedEx Ground Economy, UPS Ground Saver, whatever was picked.
// - If not, falls back to the original behavior: rate the shipment and buy the
//   cheapest USPS rate.
// With RETURNS_PROVIDER=shippo these are scan-based: you're only billed if the label is used.
export async function POST(req: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { request_id, parcel, rate_id, shipment_ref, carrier } = await req.json();
    const admin = supabaseAdmin();

    const { data: rr, error } = await admin
      .from("return_requests")
      .select("*")
      .eq("id", request_id)
      .single();
    if (error || !rr) throw new Error("Return request not found");

    const providerName = process.env.RETURNS_PROVIDER || "shippo";
    const provider = getProvider(providerName);

    const input = {
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
    };

    let buyShipmentRef: string;
    let buyRateId: string;
    let buyCarrier: string;

    if (rate_id && shipment_ref) {
      // Staff picked a specific rate from the rates modal
      buyShipmentRef = shipment_ref;
      buyRateId = rate_id;
      buyCarrier = carrier || "USPS";
    } else {
      // Legacy path: cheapest USPS
      const { shipmentRef, rates } = await provider.getRates(input);
      const uspsRates = rates.filter((r: any) => r.carrier === "USPS");
      if (!uspsRates.length) throw new Error("No USPS rates returned for this address");
      buyShipmentRef = shipmentRef;
      buyRateId = uspsRates[0].id;
      buyCarrier = "USPS";
    }

    const bought = await provider.buy({
      shipmentRef: buyShipmentRef,
      rateId: buyRateId,
      input,
    });

    const update = {
      status: "label_created",
      easypost_shipment_id: bought.shipmentRef,
      label_url: bought.label_url,
      tracking_number: bought.tracking_number,
      tracking_url: bought.tracking_url,
      carrier: buyCarrier,
      mail_class: bought.service,
      postage_amount: bought.rate,
    };

    const { error: upErr } = await admin.from("return_requests").update(update).eq("id", request_id);
    if (upErr) throw new Error(upErr.message);

    return NextResponse.json({ ok: true, ...update });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
