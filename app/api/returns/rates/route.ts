import { NextResponse } from "next/server";
import { getProvider } from "@/lib/shipping";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Rates a return shipment (customer -> boutique) across ALL connected carriers
// (USPS, FedEx Ground Economy, UPS Ground Saver, etc.) and returns the options
// so staff can pick one before purchasing.
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
    if (!rates.length) throw new Error("No rates returned for this address");

    // Cheapest first
    const sorted = [...rates].sort(
      (a: any, b: any) => parseFloat(String(a.rate)) - parseFloat(String(b.rate))
    );

    return NextResponse.json({ ok: true, shipment_ref: shipmentRef, rates: sorted });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
