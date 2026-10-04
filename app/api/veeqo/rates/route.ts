// app/api/veeqo/rates/route.ts
// POST { from, to, parcel: { weightOz, length, width, height }, reference?, value? }
// -> { rates: VeeqoRate[] }
import { NextResponse } from "next/server";
import { getVeeqoRates } from "@/lib/shipping/veeqo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body: any = await req.json();
    if (!body || !body.from || !body.to || !body.parcel) {
      return NextResponse.json({ error: "from, to and parcel are required" }, { status: 400 });
    }
    const rates = await getVeeqoRates({
      from: body.from,
      to: body.to,
      parcel: body.parcel,
      reference: body.reference,
      value: body.value,
    });
    return NextResponse.json({ rates });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Veeqo rates failed" }, { status: 502 });
  }
}
