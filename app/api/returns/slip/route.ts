// app/api/returns/slip/route.ts
// GET /api/returns/slip?code=EB-XXXXXX
// Generates a branded 2-page return packet:
//   Page 1 — print instructions + cut-out shipping label (embedded from EasyPost label_url)
//   Page 2 — packing slip with tracking barcode, placed inside the package
//
// Dependencies (package.json):
//   "pdf-lib": "^1.17.1",
//   "@pdf-lib/fontkit": "^1.1.1",
//   "bwip-js": "^4.5.1"

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, LineCapStyle } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
// @ts-ignore -- bwip-js type declarations don't resolve under this moduleResolution
import bwipjs from "bwip-js";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ====== CONFIG ======
const HEADING_FONT_FILE = "la-luxes-serif.ttf"; // in public/fonts/
const BODY_FONT_FILE = "recoleta-regular.ttf";  // in public/fonts/
const LOGO_FILE = "logo2.png";                  // in public/

const RETURN_ADDRESS = [
  "Erendira's Boutique — Returns",
  "17121 Hawthorne Ave",
  "Fontana, CA 92335",
];
// ====================

const TAUPE = rgb(0x80 / 255, 0x6a / 255, 0x52 / 255);
const SAND = rgb(0xbd / 255, 0xa8 / 255, 0x91 / 255);
const CREAM = rgb(0xf5 / 255, 0xf3 / 255, 0xef / 255);
const INK = rgb(0.2, 0.17, 0.14);

const PAGE_W = 612;
const PAGE_H = 792;
const M = 56;

async function loadFont(pdf: PDFDocument, filename: string): Promise<PDFFont | null> {
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), "public", "fonts", filename));
    return await pdf.embedFont(bytes, { subset: true });
  } catch {
    return null;
  }
}

function drawHeader(
  page: PDFPage,
  heading: PDFFont,
  body: PDFFont,
  logo: Awaited<ReturnType<PDFDocument["embedPng"]>> | null,
  title: string,
  subtitle: string
) {
  page.drawRectangle({ x: 0, y: PAGE_H - 130, width: PAGE_W, height: 130, color: CREAM });
  let textX = M;
  if (logo) {
    const h = 54;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: M, y: PAGE_H - 38 - h, width: w, height: h });
    textX = M + w + 20;
  }
  page.drawText(title, { x: textX, y: PAGE_H - 66, size: 22, font: heading, color: TAUPE });
  page.drawText(subtitle, { x: textX, y: PAGE_H - 90, size: 10.5, font: body, color: INK });
}

function wrap(text: string, max = 88): string[] {
  const lines: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(" ", max);
    if (cut < 30) cut = max;
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }
  lines.push(rest);
  return lines;
}

export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Missing return code" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: ret, error } = await supabase
    .from("return_requests")
    .select(
      "id, return_code, from_name, from_email, from_city, from_state, reason, status, tracking_number, carrier, mail_class, label_url, created_at"
    )
    .eq("return_code", code)
    .maybeSingle();

  if (error || !ret) {
    return NextResponse.json({ error: "Return not found" }, { status: 404 });
  }

  const status = String(ret.status || "").toLowerCase();
  const slipReady = !!ret.label_url || status === "label_ready" || status === "approved";
  if (!slipReady) {
    return NextResponse.json(
      { error: "Return slip isn't available yet — check back once your label is ready." },
      { status: 403 }
    );
  }

  const carrier = ret.carrier || "USPS";

  // ---------- Build PDF ----------
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const heading =
    (await loadFont(pdf, HEADING_FONT_FILE)) ??
    (await pdf.embedFont(StandardFonts.TimesRomanBold));
  const body =
    (await loadFont(pdf, BODY_FONT_FILE)) ??
    (await pdf.embedFont(StandardFonts.TimesRoman));

  // Logo
  let logo = null;
  try {
    const logoBytes = await fs.readFile(path.join(process.cwd(), "public", LOGO_FILE));
    logo = await pdf.embedPng(logoBytes);
  } catch {
    logo = null;
  }

  // Fetch the shipping label (PNG / JPG / PDF)
  let labelPng: Awaited<ReturnType<PDFDocument["embedPng"]>> | null = null;
  let labelJpg: Awaited<ReturnType<PDFDocument["embedJpg"]>> | null = null;
  let labelPdfPage: Awaited<ReturnType<PDFDocument["embedPage"]>> | null = null;
  if (ret.label_url) {
    try {
      const res = await fetch(ret.label_url);
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        const ctype = (res.headers.get("content-type") || "").toLowerCase();
        const url = ret.label_url.toLowerCase();
        if (ctype.includes("pdf") || url.includes(".pdf")) {
          const src = await PDFDocument.load(buf);
          const [embedded] = await pdf.embedPdf(src, [0]);
          labelPdfPage = embedded;
        } else if (ctype.includes("jpeg") || ctype.includes("jpg") || /\.jpe?g/.test(url)) {
          labelJpg = await pdf.embedJpg(buf);
        } else {
          labelPng = await pdf.embedPng(buf);
        }
      }
    } catch {
      // label embed failed — page 1 will show a note instead
    }
  }

  // Barcode (Code 128) of tracking number
  let barcodePng: Awaited<ReturnType<PDFDocument["embedPng"]>> | null = null;
  const barcodeText = ret.tracking_number || ret.return_code;
  try {
    const barcodeBuf = await bwipjs.toBuffer({
      bcid: "code128",
      text: barcodeText,
      scale: 3,
      height: 12,
      includetext: false,
    });
    barcodePng = await pdf.embedPng(barcodeBuf);
  } catch {
    barcodePng = null;
  }

  // ========== PAGE 1 — Shipping Label ==========
  const p1 = pdf.addPage([PAGE_W, PAGE_H]);
  drawHeader(
    p1, heading, body, logo,
    `Your ${carrier} Return Label`,
    `Cut out the label below and tape it to the outside of your package. ${carrier} only.`
  );

  let y = PAGE_H - 130 - 40;

  // CUT HERE dashed line
  const cutLabel = "CUT HERE";
  const cutW = body.widthOfTextAtSize(cutLabel, 9);
  p1.drawLine({
    start: { x: M, y }, end: { x: PAGE_W / 2 - cutW / 2 - 10, y },
    thickness: 1, color: SAND, dashArray: [4, 4], lineCap: LineCapStyle.Round,
  });
  p1.drawText(cutLabel, { x: PAGE_W / 2 - cutW / 2, y: y - 3, size: 9, font: body, color: SAND });
  p1.drawLine({
    start: { x: PAGE_W / 2 + cutW / 2 + 10, y }, end: { x: PAGE_W - M, y },
    thickness: 1, color: SAND, dashArray: [4, 4], lineCap: LineCapStyle.Round,
  });
  y -= 24;

  // Label area (4x6 label => 288 x 432 pt, rotated to fit landscape like carrier sheets)
  const areaTop = y;
  const areaBottom = 60;
  const areaH = areaTop - areaBottom;
  const areaW = PAGE_W - M * 2;

  const drawLabelBox = (w: number, h: number, drawFn: (x: number, yPos: number, w: number, h: number) => void) => {
    const scale = Math.min(areaW / w, areaH / h);
    const dw = w * scale;
    const dh = h * scale;
    const x = (PAGE_W - dw) / 2;
    const yPos = areaBottom + (areaH - dh) / 2;
    drawFn(x, yPos, dw, dh);
    p1.drawRectangle({
      x: x - 8, y: yPos - 8, width: dw + 16, height: dh + 16,
      borderColor: SAND, borderWidth: 1, borderDashArray: [4, 4],
    });
  };

  if (labelPng) {
    drawLabelBox(labelPng.width, labelPng.height, (x, yPos, w, h) =>
      p1.drawImage(labelPng!, { x, y: yPos, width: w, height: h })
    );
  } else if (labelJpg) {
    drawLabelBox(labelJpg.width, labelJpg.height, (x, yPos, w, h) =>
      p1.drawImage(labelJpg!, { x, y: yPos, width: w, height: h })
    );
  } else if (labelPdfPage) {
    drawLabelBox(labelPdfPage.width, labelPdfPage.height, (x, yPos, w, h) =>
      p1.drawPage(labelPdfPage!, { x, y: yPos, width: w, height: h })
    );
  } else {
    p1.drawText("Your label couldn't be embedded — use the Print Return Label button instead.", {
      x: M, y: areaBottom + areaH / 2, size: 10, font: body, color: TAUPE,
    });
  }

  // ========== PAGE 2 — Packing Slip ==========
  const p2 = pdf.addPage([PAGE_W, PAGE_H]);
  drawHeader(
    p2, heading, body, logo,
    "Packing Slip",
    "Please place this page inside your package."
  );

  y = PAGE_H - 130 - 40;

  // Barcode top-right
  if (barcodePng) {
    const bw = 200;
    const bh = (barcodePng.height / barcodePng.width) * bw;
    const bx = PAGE_W - M - bw;
    p2.drawImage(barcodePng, { x: bx, y: y - bh + 10, width: bw, height: bh });
    const tw = body.widthOfTextAtSize(barcodeText, 9);
    p2.drawText(barcodeText, {
      x: bx + (bw - tw) / 2, y: y - bh - 4, size: 9, font: body, color: INK,
    });
  }

  const field = (labelText: string, value: string) => {
    p2.drawText(labelText.toUpperCase(), { x: M, y, size: 8, font: body, color: SAND });
    y -= 14;
    p2.drawText(value || "—", { x: M, y, size: 12, font: body, color: INK });
    y -= 26;
  };

  field("Merchant", "Erendira's Boutique");
  field("Customer", ret.from_name || "");
  field("Return Code", ret.return_code);
  field(
    "Return Date",
    new Date(ret.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  );
  field(`${carrier} Tracking`, ret.tracking_number || "");

  if (ret.reason) {
    p2.drawText("REASON FOR RETURN", { x: M, y, size: 8, font: body, color: SAND });
    y -= 14;
    for (const line of wrap(String(ret.reason), 88).slice(0, 4)) {
      p2.drawText(line, { x: M, y, size: 11, font: body, color: INK });
      y -= 16;
    }
    y -= 12;
  }

  // Divider
  p2.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1, color: SAND });
  y -= 28;

  // Ship-to box
  p2.drawRectangle({
    x: M, y: y - 82, width: PAGE_W - M * 2, height: 100,
    color: CREAM, borderColor: SAND, borderWidth: 1,
  });
  p2.drawText("SHIP YOUR RETURN TO", { x: M + 16, y: y - 4, size: 8, font: body, color: TAUPE });
  let ay = y - 24;
  for (const line of RETURN_ADDRESS) {
    p2.drawText(line, { x: M + 16, y: ay, size: 12, font: body, color: INK });
    ay -= 17;
  }

  // Footer
  p2.drawText("Questions? Visit my.erendirasboutique.com", {
    x: M, y: 48, size: 9, font: body, color: SAND,
  });

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="return-packet-${ret.return_code}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
