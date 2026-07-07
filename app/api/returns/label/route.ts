import { NextResponse } from "next/server";
import { getProvider } from "@/lib/shipping";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Creates a USPS return label (customer -> boutique) and buys the cheapest USPS rate.
// With RETURNS_PROVIDER=shippo these are scan-based: you're only billed if the label is used.
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

    const { shipmentRef, rates } = await provider.getRates(input);
    const uspsRates = rates.filter((r) => r.carrier === "USPS");
    if (!uspsRates.length) throw new Error("No USPS rates returned for this address");

    const bought = await provider.buy({
      shipmentRef,
      rateId: uspsRates[0].id,
      input,
    });

    const update = {
      status: "label_created",
      easypost_shipment_id: bought.shipmentRef,
      label_url: bought.label_url,
      tracking_number: bought.tracking_number,
      tracking_url: bought.tracking_url,
      carrier: "USPS",
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
