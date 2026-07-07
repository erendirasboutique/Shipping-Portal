import { NextResponse } from "next/server";
import { getProvider, PROVIDERS } from "@/lib/shipping";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const provider = getProvider(body.provider);
    const result = await provider.getRates({
      to: body.to,
      parcel: body.parcel,
      signature: !!body.signature,
    });
    return NextResponse.json({
      shipment_id: result.shipmentRef,
      rates: result.rates,
      debug: {
        requested_provider: body.provider ?? "(missing)",
        known_providers: PROVIDERS,
        build: "multi-provider-v2",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
