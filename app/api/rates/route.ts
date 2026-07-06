import { NextResponse } from "next/server";
import { createShipment, filterRates } from "@/lib/easypost";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const shipment = await createShipment({
      to: body.to,
      parcel: body.parcel,
      signature: !!body.signature,
    });
    return NextResponse.json({
      shipment_id: shipment.id,
      rates: filterRates(shipment),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
