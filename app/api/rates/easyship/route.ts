// app/api/rates/easyship/route.ts
//
// Thin App Router endpoint that returns Easyship rates for a shipment.
// Mirror your existing /api/rates/easypost and /api/rates/shippo routes.

import { NextRequest, NextResponse } from "next/server";
import {
  getRates,
  EasyshipRequestError,
  type ShipmentInput,
} from "@/lib/carriers/easyship";

export async function POST(request: NextRequest) {
  try {
    const shipment = (await request.json()) as Partial<ShipmentInput>;

    if (!shipment?.from || !shipment?.to || !shipment?.parcel) {
      return NextResponse.json(
        { error: "Missing from, to, or parcel." },
        { status: 400 }
      );
    }

    const rates = await getRates(shipment as ShipmentInput);
    return NextResponse.json({ rates });
  } catch (err) {
    const status = err instanceof EasyshipRequestError ? err.status : 500;
    const message =
      err instanceof Error ? err.message : "Easyship rate request failed";
    console.error("[easyship rates]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
