// app/api/returns/slip/route.ts
// GET /api/returns/slip?code=EB-XXXXXX&lang=es
// Branded 2-page return packet (instructions + label, packing slip w/ barcode). EN/ES.
//
// Dependencies (package.json):
//   "pdf-lib": "^1.17.1",
//   "@pdf-lib/fontkit": "^1.1.1",
//   "bwip-js": "^4.5.1"

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, LineCapStyle } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
// @ts-ignore
import bwipjs from "bwip-js";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ====== CONFIG ======
const HEADING_FONT_FILE = "la-luxes-serif.ttf";
const BODY_FONT_FILE = "recoleta-regular.ttf";
const LOGO_FILE = "EB_Logo_Fall BGBLANK.png";

const RETURN_ADDRESS = [
  "Erendira's Boutique — Returns",
  "17121 Hawthorne Ave",
  "Fontana, CA 92335",
];
// ====================

const T = {
  en: {
    p1Title: (c: string) => `Print this paper & attach the ${c} label`,
    p1Sub: "Steps to successfully return your items",
    steps: (c: string) => [
      "Please print this paper.",
      "Cut out the label below.",
      "Package & seal items into a poly bag or box.",
      "Tape this label to the package.",
      `Drop off the package at a ${c} location.`,
    ],
    slipNote: "•  Don't forget to include the packing slip (page 2) inside the package.",
    cutHere: "CUT HERE",
    warning: (c: string) =>
      `This label is ONLY accepted at ${c} locations. Using this label with any other carrier will cause your return to fail.`,
    labelFail: "Your label couldn't be embedded — use the Print Return Label button instead.",
    p2Title: "Packing Slip",
    p2Sub: "Please place this page inside your package.",
    merchant: "Merchant",
    customer: "Customer",
    returnCode: "Return Code",
    returnDate: "Return Date",
    tracking: (c: string) => `${c} Tracking`,
    reason: "Reason for Return",
    shipTo: "SHIP YOUR RETURN TO",
    footer: "Questions? Visit my.erendirasboutique.com",
    locale: "en-US",
  },
  es: {
    p1Title: (c: string) => `Imprime esta hoja y pega la etiqueta de ${c}`,
    p1Sub: "Pasos para devolver tus artículos con éxito",
    steps: (c: string) => [
      "Imprime esta hoja.",
      "Recorta la etiqueta de abajo.",
      "Empaca y sella tus artículos en una bolsa o caja.",
      "Pega esta etiqueta al paquete.",
      `Entrega el paquete en cualquier oficina de ${c}.`,
    ],
    slipNote: "•  No olvides incluir la hoja de empaque (página 2) dentro del paquete.",
    cutHere: "CORTA AQUÍ",
    warning: (c: string) =>
      `Esta etiqueta SOLO se acepta en oficinas de ${c}. Usarla con otra paquetería hará que tu devolución falle.`,
    labelFail: "No se pudo incluir tu etiqueta — usa el botón Imprimir Etiqueta en su lugar.",
    p2Title: "Hoja de Empaque",
    p2Sub: "Coloca esta página dentro de tu paquete.",
    merchant: "Comercio",
    customer: "Cliente",
    returnCode: "Código de Devolución",
    returnDate: "Fecha de Devolución",
    tracking: (c: string) => `Rastreo ${c}`,
    reason: "Motivo de la Devolución",
    shipTo: "ENVÍA TU DEVOLUCIÓN A",
    footer: "¿Preguntas? Visita my.erendirasboutique.com",
    locale: "es-MX",
  },
};

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
  const maxW = PAGE_W - M - textX;
  let size = 22;
  while (size > 12 && heading.widthOfTextAtSize(title, size) > maxW) {
    size -= 0.5;
  }
  page.drawText(title, { x: textX, y: PAGE_H - 66, size, font: heading, color: TAUPE });
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
  const lang = req.nextUrl.searchParams.get("lang") === "es" ? "es" : "en";
  const t = T[lang];

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
      // label embed failed — page 1 shows a note instead
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

  // ========== PAGE 1 — Instructions + Shipping Label ==========
  const p1 = pdf.addPage([PAGE_W, PAGE_H]);
  drawHeader(p1, heading, body, logo, t.p1Title(carrier), t.p1Sub);

  let y = PAGE_H - 130 - 34;

  t.steps(carrier).forEach((s, i) => {
    wrap(s, 82).forEach((line, j) => {
      p1.drawText(j === 0 ? `${i + 1}.  ${line}` : `     ${line}`, {
        x: M, y, size: 11.5, font: body, color: INK,
      });
      y -= 17;
    });
    y -= 3;
  });
  p1.drawText(t.slipNote, {
    x: M + 18, y, size: 11, font: body, color: TAUPE,
  });
  y -= 28;

  // CUT HERE dashed line
  const cutLabel = t.cutHere;
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
  y -= 18;

  for (const line of wrap(t.warning(carrier), 88)) {
    p1.drawText(line, { x: M, y, size: 9, font: body, color: TAUPE });
    y -= 13;
  }
  y -= 8;

  // Label area
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
    p1.drawText(t.labelFail, {
      x: M, y: areaBottom + areaH / 2, size: 10, font: body, color: TAUPE,
    });
  }

  // ========== PAGE 2 — Packing Slip ==========
  const p2 = pdf.addPage([PAGE_W, PAGE_H]);
  drawHeader(p2, heading, body, logo, t.p2Title, t.p2Sub);

  y = PAGE_H - 130 - 40;

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

  field(t.merchant, "Erendira's Boutique");
  field(t.customer, ret.from_name || "");
  field(t.returnCode, ret.return_code);
  field(
    t.returnDate,
    new Date(ret.created_at).toLocaleDateString(t.locale, { year: "numeric", month: "long", day: "numeric" })
  );
  field(t.tracking(carrier), ret.tracking_number || "");

  if (ret.reason) {
    p2.drawText(t.reason.toUpperCase(), { x: M, y, size: 8, font: body, color: SAND });
    y -= 14;
    for (const line of wrap(String(ret.reason), 88).slice(0, 4)) {
      p2.drawText(line, { x: M, y, size: 11, font: body, color: INK });
      y -= 16;
    }
    y -= 12;
  }

  p2.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1, color: SAND });
  y -= 28;

  p2.drawRectangle({
    x: M, y: y - 82, width: PAGE_W - M * 2, height: 100,
    color: CREAM, borderColor: SAND, borderWidth: 1,
  });
  p2.drawText(t.shipTo, { x: M + 16, y: y - 4, size: 8, font: body, color: TAUPE });
  let ay = y - 24;
  for (const line of RETURN_ADDRESS) {
    p2.drawText(line, { x: M + 16, y: ay, size: 12, font: body, color: INK });
    ay -= 17;
  }

  p2.drawText(t.footer, { x: M, y: 48, size: 9, font: body, color: SAND });

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
