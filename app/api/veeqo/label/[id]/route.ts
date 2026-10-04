// app/api/veeqo/label/[id]/route.ts
// GET  -> streams the label PDF (reprint). id = remote shipment id or tracking number
// DELETE -> voids the label
import { NextResponse } from "next/server";
import { getVeeqoLabelPdf, voidVeeqoLabel } from "@/lib/shipping/veeqo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const pdf = await getVeeqoLabelPdf(ctx.params.id);
    return new NextResponse(pdf, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'inline; filename="label-' + ctx.params.id + '.pdf"',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Label not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    await voidVeeqoLabel(ctx.params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Void failed" }, { status: 502 });
  }
}
