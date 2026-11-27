// app/api/equipo/qr/route.ts
// Staff only. GET ?b=<basketId>: the QR code for a basket sticker, as SVG.
// It holds a link to the Saturday scan for that basket, so a phone camera
// opens it directly too.

import { NextResponse } from "next/server";
import bwipjs from "bwip-js";
import { staffUser } from "@/lib/liveList";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await staffUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("b") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const text = url.origin + "/equipo/escanear?b=" + id;
  const svg = (bwipjs as any).toSVG({ bcid: "qrcode", text, eclevel: "M", paddingwidth: 0, paddingheight: 0 });
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=86400" },
  });
}
