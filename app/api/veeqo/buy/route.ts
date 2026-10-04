// app/api/veeqo/buy/route.ts
// POST { remoteShipmentId, rateId, insuranceAmount? }
// -> { trackingNumber, carrier, service, amount, remoteShipmentId, labelPdfBase64 }
// Note: Veeqo quotes expire ~30 min after rating. If buying fails with "expired", re-rate.
import { NextResponse } from "next/server";
import { buyVeeqoLabel } from "@/lib/shipping/veeqo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body: any = await req.json();
    if (!body || !body.remoteShipmentId || !body.rateId) {
      return NextResponse.json({ error: "remoteShipmentId and rateId are required" }, { status: 400 });
    }
    const label = await buyVeeqoLabel({
      remoteShipmentId: body.remoteShipmentId,
      rateId: body.rateId,
      insuranceAmount: body.insuranceAmount,
    });
    return NextResponse.json(label);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Veeqo label purchase failed" }, { status: 502 });
  }
}
