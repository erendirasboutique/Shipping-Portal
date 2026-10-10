// app/api/returns/slip/route.ts
// GET /api/returns/slip?code=EB-XXXXXX&lang=es
// One-page return packet (EN/ES):
//   top half    → steps + packing slip (goes inside the box)
//   bottom half → the shipping label, turned sideways at its real 6 × 4 size (taped on the box)
//
// Dependencies (package.json):
//   "pdf-lib": "^1.17.1",
//   "@pdf-lib/fontkit": "^1.1.1",
//   "bwip-js": "^4.5.1"

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, PDFFont, PDFPage, PDFImage, PDFEmbeddedPage, rgb, degrees, StandardFonts, LineCapStyle, Color } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
// @ts-ignore
import bwipjs from "bwip-js";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ====== CONFIG ======
// Fonts live in public/fonts. The first file that exists is used.
const HEADING_FONTS = ["sltfthesilvereditorial-regular.otf", "la-luxes-serif.ttf"];
const BODY_FONTS = ["CooperLtBT-Regular.ttf", "recoleta-regular.ttf"];
const LOGO_FILE = "EB_Logo_Fall BGBLANK.png";

const RETURN_ADDRESS = "Erendira's Boutique — Returns · 17121 Hawthorne Ave, Fontana, CA 92335";
const WEBSITE = "my.erendirasboutique.com";
// ====================

const T = {
  en: {
    title: "Your return is ready",
    steps: (c: string): [string, string][] => [
      ["Print", "this page"],
      ["Cut", "on the dashed line"],
      ["Pack", "items + top part"],
      ["Tape", "label on the box"],
      ["Drop off", "at any " + c],
    ],
    slipTitle: "Packing slip",
    slipNote: "Put this part inside the box",
    customer: "Customer",
    returnDate: "Return date",
    carrier: "Carrier",
    reason: "Reason",
    cutHere: "CUT HERE  ·  TAPE THE LABEL BELOW ON YOUR BOX",
    warning: (c: string) => "Only " + c + " accepts this label  ·  Questions? " + WEBSITE,
    labelFail: "Your label couldn't be added here. Use the Print Return Label button instead.",
    returnsTo: "Returns to " + RETURN_ADDRESS,
    findTitle: (c: string) => (c.toUpperCase() === "USPS" ? "Find a post office near you" : "Find a " + c + " drop-off near you"),
    findSub: "Scan with your phone camera to see the closest ones on a map.",
    locale: "en-US",
  },
  es: {
    title: "Tu devolución está lista",
    steps: (c: string): [string, string][] => [
      ["Imprime", "esta hoja"],
      ["Recorta", "por la línea"],
      ["Empaca", "artículos + parte de arriba"],
      ["Pega", "la etiqueta en la caja"],
      ["Entrega", "en cualquier " + c],
    ],
    slipTitle: "Hoja de empaque",
    slipNote: "Pon esta parte dentro de la caja",
    customer: "Cliente",
    returnDate: "Fecha",
    carrier: "Paquetería",
    reason: "Motivo",
    cutHere: "CORTA AQUÍ  ·  PEGA LA ETIQUETA DE ABAJO EN TU CAJA",
    warning: (c: string) => "Solo " + c + " acepta esta etiqueta  ·  ¿Preguntas? " + WEBSITE,
    labelFail: "No se pudo incluir tu etiqueta aquí. Usa el botón Imprimir Etiqueta.",
    returnsTo: "Se devuelve a " + RETURN_ADDRESS,
    findTitle: (c: string) => (c.toUpperCase() === "USPS" ? "Encuentra una oficina de correos cerca" : "Encuentra un punto de " + c + " cerca"),
    findSub: "Escanéala con la cámara de tu teléfono para verlas en el mapa.",
    locale: "es-MX",
  },
};

// Brand colors (a touch darker than the screen colors so they print well)
const TAUPE = rgb(0x80 / 255, 0x6a / 255, 0x52 / 255);
const SAND = rgb(0xcf / 255, 0xbd / 255, 0xa9 / 255);
const LINE = rgb(0xe7 / 255, 0xdd / 255, 0xd1 / 255);
const MUTED = rgb(0xa8 / 255, 0x95 / 255, 0x7f / 255);
const SOFT = rgb(0x8d / 255, 0x7c / 255, 0x69 / 255);
const INK = rgb(0x33 / 255, 0x2b / 255, 0x23 / 255);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const M = 36; // side margin

// The label area: 6" wide × 4" tall (a 4×6 label turned sideways), across the bottom
const LABEL_W = 432;
const LABEL_H = 288;
const LABEL_X = (PAGE_W - LABEL_W) / 2;
const LABEL_Y = 76;
const CUT_Y = LABEL_Y + LABEL_H + 7 + 24; // dashed cut line above the label box

async function loadFont(pdf: PDFDocument, files: string[]): Promise<PDFFont | null> {
  for (const file of files) {
    try {
      const bytes = await fs.readFile(path.join(process.cwd(), "public", "fonts", file));
      // .otf (CFF) fonts are embedded whole — subsetting them can garble letters
      return await pdf.embedFont(bytes, { subset: !file.toLowerCase().endsWith(".otf") });
    } catch {
      // try the next one
    }
  }
  return null;
}

// Text helpers ----------------------------------------------------------

/** Characters a font can't draw are swapped for close ones (or dropped), so the PDF never fails. */
function safe(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      const fallback = ch === "—" || ch === "–" ? "-" : ch === "·" ? "-" : ch === "’" ? "'" : "";
      if (fallback) {
        try {
          font.encodeText(fallback);
          out += fallback;
        } catch {}
      }
    }
  }
  return out;
}

function wrapWidth(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(next, size) <= maxW || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function text(page: PDFPage, font: PDFFont, s: string, x: number, y: number, size: number, color: Color) {
  page.drawText(safe(font, s), { x, y, size, font, color });
}

function centered(page: PDFPage, font: PDFFont, s: string, cx: number, y: number, size: number, color: Color) {
  const str = safe(font, s);
  page.drawText(str, { x: cx - font.widthOfTextAtSize(str, size) / 2, y, size, font, color });
}

/** Small caps-style label: spaced-out uppercase */
function eyebrow(page: PDFPage, font: PDFFont, s: string, x: number, y: number, color: Color = MUTED) {
  page.drawText(safe(font, s.toUpperCase()), { x, y, size: 7.5, font, color });
}

/** Rounded rectangle. (x, top) is the top-left corner. */
function roundRect(
  page: PDFPage,
  x: number,
  top: number,
  w: number,
  h: number,
  r: number,
  opts: { color?: Color; borderColor?: Color; borderWidth?: number; borderDashArray?: number[] }
) {
  const d =
    `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} ` +
    `H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  page.drawSvgPath(d, { x, y: top, ...opts });
}

function dashed(page: PDFPage, x1: number, x2: number, y: number) {
  if (x2 <= x1) return;
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 1,
    color: SAND,
    dashArray: [4, 4],
    lineCap: LineCapStyle.Round,
  });
}

/** Google Maps search for drop-off spots near wherever the customer's phone is. */
function dropOffUrl(carrier: string): string {
  const c = carrier.toUpperCase();
  const q = c === "USPS" ? "post office" : c === "UPS" ? "UPS drop off" : c.indexOf("FEDEX") >= 0 ? "FedEx drop off" : carrier + " drop off";
  return "https://www.google.com/maps/search/" + encodeURIComponent(q + " near me");
}

// Route ----------------------------------------------------------------

export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
  const lang = req.nextUrl.searchParams.get("lang") === "es" ? "es" : "en";
  const t = T[lang];

  if (!code) {
    return NextResponse.json({ error: "Missing return code" }, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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

  const carrier: string = ret.carrier || "USPS";

  // ---------- Build PDF ----------
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle("Return " + ret.return_code + " — Erendira's Boutique");

  const heading = (await loadFont(pdf, HEADING_FONTS)) ?? (await pdf.embedFont(StandardFonts.TimesRoman));
  const body = (await loadFont(pdf, BODY_FONTS)) ?? (await pdf.embedFont(StandardFonts.TimesRoman));

  let logo: PDFImage | null = null;
  try {
    logo = await pdf.embedPng(await fs.readFile(path.join(process.cwd(), "public", LOGO_FILE)));
  } catch {
    logo = null;
  }

  // The shipping label (PNG / JPG / PDF)
  let labelImg: PDFImage | null = null;
  let labelPage: PDFEmbeddedPage | null = null;
  if (ret.label_url) {
    try {
      const res = await fetch(ret.label_url);
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        const ctype = (res.headers.get("content-type") || "").toLowerCase();
        const url = String(ret.label_url).toLowerCase();
        if (ctype.includes("pdf") || url.includes(".pdf")) {
          const src = await PDFDocument.load(buf);
          const [embedded] = await pdf.embedPdf(src, [0]);
          labelPage = embedded;
        } else if (ctype.includes("jpeg") || ctype.includes("jpg") || /\.jpe?g/.test(url)) {
          labelImg = await pdf.embedJpg(buf);
        } else {
          labelImg = await pdf.embedPng(buf);
        }
      }
    } catch {
      // couldn't add it — a note is shown in its place
    }
  }

  // Barcode of the return code, so the boutique can scan the slip when the box arrives
  let barcode: PDFImage | null = null;
  try {
    const png = await bwipjs.toBuffer({ bcid: "code128", text: ret.return_code, scale: 3, height: 10, includetext: false });
    barcode = await pdf.embedPng(png);
  } catch {
    barcode = null;
  }

  // QR code that opens a map of nearby drop-off spots
  let qr: PDFImage | null = null;
  try {
    const png = await bwipjs.toBuffer({ bcid: "qrcode", text: dropOffUrl(carrier), scale: 4, eclevel: "M", paddingwidth: 0 });
    qr = await pdf.embedPng(png);
  } catch {
    qr = null;
  }

  const page = pdf.addPage([PAGE_W, PAGE_H]);

  // ===== Header =====
  const headerH = 64;
  let hx = M;
  if (logo) {
    const lh = 36;
    const lw = (logo.width / logo.height) * lh;
    page.drawImage(logo, { x: M, y: PAGE_H - headerH / 2 - lh / 2, width: lw, height: lh });
    hx = M + lw + 14;
  }

  // Return code pill (right)
  const pillText = safe(body, ret.return_code);
  const pillSize = 10.5;
  const pillW = body.widthOfTextAtSize(pillText, pillSize) + 24;
  const pillH = 22;
  const pillX = PAGE_W - M - pillW;
  roundRect(page, pillX, PAGE_H - headerH / 2 + pillH / 2, pillW, pillH, pillH / 2, { borderColor: SAND, borderWidth: 1 });
  page.drawText(pillText, { x: pillX + 12, y: PAGE_H - headerH / 2 - 3.5, size: pillSize, font: body, color: TAUPE });

  // Title (shrinks if a long translation needs it)
  const titleMax = pillX - 16 - hx;
  let titleSize = 22;
  while (titleSize > 14 && heading.widthOfTextAtSize(safe(heading, t.title), titleSize) > titleMax) titleSize -= 0.5;
  text(page, heading, t.title, hx, PAGE_H - headerH / 2 - titleSize * 0.32, titleSize, TAUPE);

  page.drawLine({ start: { x: 0, y: PAGE_H - headerH }, end: { x: PAGE_W, y: PAGE_H - headerH }, thickness: 1, color: LINE });

  // ===== Steps (a row of 5) =====
  const steps = t.steps(carrier);
  const colW = (PAGE_W - M * 2) / steps.length;
  const circleY = PAGE_H - headerH - 26;
  page.drawLine({
    start: { x: M + colW / 2, y: circleY },
    end: { x: PAGE_W - M - colW / 2, y: circleY },
    thickness: 0.8,
    color: LINE,
  });
  steps.forEach(([word, sub], i) => {
    const cx = M + colW * i + colW / 2;
    page.drawCircle({ x: cx, y: circleY, size: 11, color: TAUPE });
    centered(page, body, String(i + 1), cx, circleY - 3.6, 10, WHITE);
    centered(page, body, word, cx, circleY - 25, 10.5, INK);
    centered(page, body, sub, cx, circleY - 36.5, 8.5, SOFT);
  });

  // ===== Packing slip card =====
  const cardX = M;
  const cardW = PAGE_W - M * 2;
  const cardTop = circleY - 52;
  const pad = 16;
  const barW = 140;
  const fieldsW = cardW - pad * 2 - barW - 18;
  const colF = fieldsW / 3;

  // Measure the reason first so the card fits it
  const reasonLines = ret.reason ? wrapWidth(body, safe(body, String(ret.reason)), 11.5, fieldsW).slice(0, 3) : [];
  const cardH = 26 /*title*/ + 14 + 34 /*fields*/ + (reasonLines.length ? 14 + reasonLines.length * 14 + 6 : 0) + pad + 4;
  roundRect(page, cardX, cardTop, cardW, cardH, 12, { borderColor: LINE, borderWidth: 1 });

  let y = cardTop - pad - 14;
  text(page, heading, t.slipTitle, cardX + pad, y, 18, TAUPE);
  const note = safe(body, t.slipNote);
  page.drawText(note, { x: cardX + cardW - pad - body.widthOfTextAtSize(note, 8.5), y: y + 3, size: 8.5, font: body, color: MUTED });

  y -= 26;
  const dateStr = new Date(ret.created_at).toLocaleDateString(t.locale, { year: "numeric", month: "short", day: "numeric" });
  const fields: [string, string][] = [
    [t.customer, ret.from_name || "—"],
    [t.returnDate, dateStr],
    [t.carrier, carrier],
  ];
  fields.forEach(([label, value], i) => {
    const fx = cardX + pad + colF * i;
    eyebrow(page, body, label, fx, y);
    const v = wrapWidth(body, safe(body, value), 12, colF - 12)[0] || "";
    page.drawText(v, { x: fx, y: y - 15, size: 12, font: body, color: INK });
  });
  y -= 34;

  if (reasonLines.length) {
    y -= 8;
    eyebrow(page, body, t.reason, cardX + pad, y);
    y -= 15;
    for (const line of reasonLines) {
      page.drawText(line, { x: cardX + pad, y, size: 11.5, font: body, color: INK });
      y -= 14;
    }
  }

  // Barcode + return code (right side of the card)
  const barX = cardX + cardW - pad - barW;
  const barTop = cardTop - pad - 30;
  if (barcode) {
    const bh = 40;
    page.drawImage(barcode, { x: barX, y: barTop - bh, width: barW, height: bh });
    centered(page, heading, ret.return_code, barX + barW / 2, barTop - bh - 17, 15, TAUPE);
  } else {
    centered(page, heading, ret.return_code, barX + barW / 2, barTop - 24, 18, TAUPE);
  }

  // Return address (small, under the card)
  const addr = safe(body, t.returnsTo);
  page.drawText(addr, { x: M, y: cardTop - cardH - 16, size: 8.5, font: body, color: MUTED });


  // "Find a post office near you" QR, in the space between the slip and the cut line
  const addrY = cardTop - cardH - 16;
  const gap = addrY - 14 - (CUT_Y + 8); // room between the address line and the cut line
  if (qr && gap >= 52) {
    const qs = Math.min(64, gap - 16);
    const qy = CUT_Y + 8 + (gap - qs) / 2;
    const title = safe(heading, t.findTitle(carrier));
    const titleSize = 15;
    const sub = safe(body, t.findSub);
    const textW = Math.max(heading.widthOfTextAtSize(title, titleSize), body.widthOfTextAtSize(sub, 9));
    const groupW = qs + 14 + textW;
    const gx = (PAGE_W - groupW) / 2;
    roundRect(page, gx - 6, qy + qs + 6, qs + 12, qs + 12, 8, { borderColor: LINE, borderWidth: 1 });
    page.drawImage(qr, { x: gx, y: qy, width: qs, height: qs });
    page.drawText(title, { x: gx + qs + 14, y: qy + qs / 2 + 2, size: titleSize, font: heading, color: TAUPE });
    page.drawText(sub, { x: gx + qs + 14, y: qy + qs / 2 - 13, size: 9, font: body, color: SOFT });
  }

  // ===== Cut line =====
  const cut = safe(body, t.cutHere);
  const cutSize = 7.5;
  const cutW = body.widthOfTextAtSize(cut, cutSize);
  dashed(page, M, PAGE_W / 2 - cutW / 2 - 10, CUT_Y);
  page.drawText(cut, { x: PAGE_W / 2 - cutW / 2, y: CUT_Y - 2.5, size: cutSize, font: body, color: MUTED });
  dashed(page, PAGE_W / 2 + cutW / 2 + 10, PAGE_W - M, CUT_Y);

  // ===== Label, sideways, across the bottom =====
  // Dashed cut box around the label area
  roundRect(page, LABEL_X - 7, LABEL_Y + LABEL_H + 7, LABEL_W + 14, LABEL_H + 14, 5, {
    borderColor: SAND,
    borderWidth: 1,
    borderDashArray: [4, 4],
  });

  const placeLabel = (w0: number, h0: number, draw: (o: { x: number; y: number; width: number; height: number; rotate?: ReturnType<typeof degrees> }) => void) => {
    if (h0 >= w0) {
      // Portrait label → turn it 90° so it lies sideways. Its top ends up on the left.
      const s = Math.min(LABEL_W / h0, LABEL_H / w0);
      const dw = w0 * s; // becomes the height on the page
      const dh = h0 * s; // becomes the width on the page
      const left = LABEL_X + (LABEL_W - dh) / 2;
      const bottom = LABEL_Y + (LABEL_H - dw) / 2;
      // pdf-lib turns around the bottom-left corner, counter-clockwise
      draw({ x: left + dh, y: bottom, width: dw, height: dh, rotate: degrees(90) });
    } else {
      // Already landscape → just fit it
      const s = Math.min(LABEL_W / w0, LABEL_H / h0);
      const dw = w0 * s;
      const dh = h0 * s;
      draw({ x: LABEL_X + (LABEL_W - dw) / 2, y: LABEL_Y + (LABEL_H - dh) / 2, width: dw, height: dh });
    }
  };

  if (labelImg) {
    const img = labelImg;
    placeLabel(img.width, img.height, (o) => page.drawImage(img, o));
  } else if (labelPage) {
    const lp = labelPage;
    placeLabel(lp.width, lp.height, (o) => page.drawPage(lp, o));
  } else {
    const lines = wrapWidth(body, safe(body, t.labelFail), 11, LABEL_W - 60);
    let ly = LABEL_Y + LABEL_H / 2 + (lines.length * 15) / 2 - 11;
    for (const line of lines) {
      centered(page, body, line, PAGE_W / 2, ly, 11, TAUPE);
      ly -= 15;
    }
  }

  // Under the label
  centered(page, body, t.warning(carrier), PAGE_W / 2, LABEL_Y - 7 - 16, 8.5, MUTED);

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
