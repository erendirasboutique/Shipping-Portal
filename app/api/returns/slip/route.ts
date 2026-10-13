// app/api/returns/slip/route.ts
// GET /api/returns/slip?code=EB-XXXXXX&lang=es               → letter page (what customers get)
// GET /api/returns/slip?code=EB-XXXXXX&lang=es&format=4x6    → 4×6 label printer version (admin)
//
// Letter (default), one page:
//   top half    → steps + packing slip + drop-off QR (goes inside the box)
//   bottom half → the shipping label, turned sideways at its real 6 × 4 size (taped on the box)
//
// 4×6, two pages for thermal label printers:
//   page 1 → the shipping label, full size, nothing to cut
//   page 2 → packing slip in plain black (prints cleanly on thermal paper)
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
    // 4×6 packing slip
    slipCaps: "PACKING SLIP",
    tracking: "Tracking",
    insideBox: "Put this slip inside the box.",
    scanQr: (c: string) => "Scan to find a " + (c.toUpperCase() === "USPS" ? "post office" : c + " drop-off") + " near you.",
    questions: "Questions? " + WEBSITE,
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
    // 4×6 packing slip
    slipCaps: "HOJA DE EMPAQUE",
    tracking: "Rastreo",
    insideBox: "Pon esta hoja dentro de la caja.",
    scanQr: (c: string) => "Escanea para ver " + (c.toUpperCase() === "USPS" ? "oficinas de correos" : "puntos de " + c) + " cerca.",
    questions: "¿Preguntas? " + WEBSITE,
    locale: "es-MX",
  },
};

// Brand colors (a touch darker than the screen colors so they print well)
const BROWN = rgb(0x5b / 255, 0x4a / 255, 0x38 / 255);
const MUTED = rgb(0x7a / 255, 0x6a / 255, 0x57 / 255);
const LINE = rgb(0xdc / 255, 0xd2 / 255, 0xc5 / 255);
const SAND = rgb(0xb7 / 255, 0xa6 / 255, 0x93 / 255);
const INK = rgb(0x33 / 255, 0x2b / 255, 0x23 / 255);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);

const SMALL_W = 288; // 4 × 6 in, portrait
const SMALL_H = 432;

const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const M = 36; // side margin

// The label area: 6" wide × 4" tall (a 4×6 label turned sideways), across the bottom
const LABEL_W = 432;
const LABEL_H = 288;
const LABEL_X = (PAGE_W - LABEL_W) / 2;
const LABEL_Y = 54; // 0.75" from the bottom edge
const CUT_Y = LABEL_Y + LABEL_H + 7 + 22; // dashed cut line above the label box

// Turn off ligatures and other letter-joining. pdf-lib draws joined letters (like "fi" or "st")
// with the wrong width, which is what put gaps inside words ("ofi cina", "est á").
const PLAIN_LETTERS = { liga: false, clig: false, dlig: false, hlig: false, calt: false, rlig: false };

async function loadFont(pdf: PDFDocument, files: string[]): Promise<PDFFont | null> {
  for (const file of files) {
    try {
      const bytes = await fs.readFile(path.join(process.cwd(), "public", "fonts", file));
      // .otf (CFF) fonts are embedded whole — subsetting them can garble letters
      return await pdf.embedFont(bytes, { subset: !file.toLowerCase().endsWith(".otf"), features: PLAIN_LETTERS });
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

/** Shrinks the size until the text fits in maxW (never below minSize). */
function fitSize(font: PDFFont, s: string, size: number, maxW: number, minSize: number) {
  while (size > minSize && font.widthOfTextAtSize(s, size) > maxW) size -= 0.5;
  return size;
}

function text(page: PDFPage, font: PDFFont, s: string, x: number, y: number, size: number, color: Color) {
  page.drawText(safe(font, s), { x, y, size, font, color });
}

function centered(page: PDFPage, font: PDFFont, s: string, cx: number, y: number, size: number, color: Color) {
  const str = safe(font, s);
  page.drawText(str, { x: cx - font.widthOfTextAtSize(str, size) / 2, y, size, font, color });
}

/** Small uppercase label above a value */
function eyebrow(page: PDFPage, font: PDFFont, s: string, x: number, y: number) {
  page.drawText(safe(font, s.toUpperCase()), { x, y, size: 7.5, font, color: MUTED });
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

// 4×6 version ------------------------------------------------------------

type Lang = keyof typeof T;

function draw4x6(
  pdf: PDFDocument,
  o: {
    t: (typeof T)[Lang];
    ret: any;
    carrier: string;
    heading: PDFFont;
    body: PDFFont;
    labelImg: PDFImage | null;
    labelPage: PDFEmbeddedPage | null;
    barcode: PDFImage | null;
    qr: PDFImage | null;
  }
) {
  const { t, ret, carrier, heading, body, labelImg, labelPage, barcode, qr } = o;

  // ----- Page 1: the label, filling the 4×6 page -----
  const p1 = pdf.addPage([SMALL_W, SMALL_H]);
  const fit = (w0: number, h0: number, draw: (o: { x: number; y: number; width: number; height: number; rotate?: ReturnType<typeof degrees> }) => void) => {
    if (h0 >= w0) {
      // Portrait label → as is
      const s = Math.min(SMALL_W / w0, SMALL_H / h0);
      const dw = w0 * s;
      const dh = h0 * s;
      draw({ x: (SMALL_W - dw) / 2, y: (SMALL_H - dh) / 2, width: dw, height: dh });
    } else {
      // Landscape label → turn it upright
      const s = Math.min(SMALL_W / h0, SMALL_H / w0);
      const dw = w0 * s; // becomes the height on the page
      const dh = h0 * s; // becomes the width on the page
      draw({ x: (SMALL_W - dh) / 2 + dh, y: (SMALL_H - dw) / 2, width: dw, height: dh, rotate: degrees(90) });
    }
  };
  if (labelImg) {
    const img = labelImg;
    fit(img.width, img.height, (opts) => p1.drawImage(img, opts));
  } else if (labelPage) {
    const lp = labelPage;
    fit(lp.width, lp.height, (opts) => p1.drawPage(lp, opts));
  } else {
    const lines = wrapWidth(body, safe(body, t.labelFail), 11, SMALL_W - 48);
    let ly = SMALL_H / 2 + (lines.length * 15) / 2 - 11;
    for (const line of lines) {
      centered(p1, body, line, SMALL_W / 2, ly, 11, BLACK);
      ly -= 15;
    }
  }

  // ----- Page 2: packing slip, black only -----
  const p = pdf.addPage([SMALL_W, SMALL_H]);
  const m = 18;
  const w = SMALL_W - m * 2;
  let y = SMALL_H - m;

  // Name + "PACKING SLIP"
  text(p, heading, "Erendira's", m, y - 14, 16, BLACK);
  text(p, heading, "Boutique", m, y - 31, 16, BLACK);
  const caps = safe(body, t.slipCaps);
  p.drawText(caps, { x: SMALL_W - m - body.widthOfTextAtSize(caps, 8), y: y - 14, size: 8, font: body, color: BLACK });
  y -= 42;
  p.drawLine({ start: { x: m, y }, end: { x: SMALL_W - m, y }, thickness: 2, color: BLACK });

  // Barcode + code
  y -= 12;
  const codeText = safe(body, ret.return_code);
  if (barcode) {
    p.drawImage(barcode, { x: m, y: y - 52, width: w, height: 52 });
    y -= 52;
  }
  y -= 20;
  centered(p, body, codeText, SMALL_W / 2, y, 17, BLACK);
  y -= 16;

  // Detail rows
  const dateStr = new Date(ret.created_at).toLocaleDateString(t.locale, { year: "numeric", month: "short", day: "numeric" });
  const rows: [string, string][] = [
    [t.customer, ret.from_name || "—"],
    [t.returnDate, dateStr],
    [t.carrier, carrier],
  ];
  if (ret.tracking_number) rows.push([t.tracking, String(ret.tracking_number).replace(/(.{4})/g, "$1 ").trim()]);
  const valueW = w - 78;

  const rule = () => p.drawLine({ start: { x: m, y }, end: { x: SMALL_W - m, y }, thickness: 0.75, color: BLACK });
  for (const [label, value] of rows) {
    rule();
    const v = safe(body, value);
    const vs = fitSize(body, v, 10, valueW, 7);
    text(p, body, label, m, y - 14, 9.5, BLACK);
    p.drawText(v, { x: SMALL_W - m - body.widthOfTextAtSize(v, vs), y: y - 14, size: vs, font: body, color: BLACK });
    y -= 21;
  }
  if (ret.reason) {
    rule();
    const lines = wrapWidth(body, safe(body, String(ret.reason)), 9.5, valueW).slice(0, 3);
    text(p, body, t.reason, m, y - 14, 9.5, BLACK);
    lines.forEach((line, i) => {
      p.drawText(line, { x: SMALL_W - m - body.widthOfTextAtSize(line, 9.5), y: y - 14 - i * 12, size: 9.5, font: body, color: BLACK });
    });
    y -= 21 + (lines.length - 1) * 12;
  }
  rule();

  // QR + "put this inside the box"
  const qs = 56;
  const qy = 34;
  const tx = qr ? m + qs + 12 : m;
  if (qr) p.drawImage(qr, { x: m, y: qy, width: qs, height: qs });
  const inside = wrapWidth(body, safe(body, t.insideBox), 9.5, SMALL_W - m - tx);
  let ty = qy + qs - 10;
  for (const line of inside) {
    p.drawText(line, { x: tx, y: ty, size: 9.5, font: body, color: BLACK });
    ty -= 12;
  }
  if (qr) {
    ty -= 2;
    for (const line of wrapWidth(body, safe(body, t.scanQr(carrier)), 8, SMALL_W - m - tx)) {
      p.drawText(line, { x: tx, y: ty, size: 8, font: body, color: BLACK });
      ty -= 10;
    }
  }
  centered(p, body, t.questions, SMALL_W / 2, 16, 7, BLACK);
}

// Route ----------------------------------------------------------------

export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
  const lang = req.nextUrl.searchParams.get("lang") === "es" ? "es" : "en";
  const format = req.nextUrl.searchParams.get("format") === "4x6" ? "4x6" : "letter";
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

  // ===== 4×6 version (two pages) =====
  if (format === "4x6") {
    draw4x6(pdf, { t, ret, carrier, heading, body, labelImg, labelPage, barcode, qr });
    const small = await pdf.save();
    return new NextResponse(Buffer.from(small), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="return-label-4x6-${ret.return_code}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ===== Letter version (one page) =====
  const page = pdf.addPage([PAGE_W, PAGE_H]);

  // ===== Header: logo · title · code pill =====
  const headerH = 64;
  const headerMid = PAGE_H - headerH / 2;
  let hx = M;
  if (logo) {
    const lh = 38;
    const lw = (logo.width / logo.height) * lh;
    page.drawImage(logo, { x: M, y: headerMid - lh / 2, width: lw, height: lh });
    hx = M + lw + 16;
  }

  const pillText = safe(body, ret.return_code);
  const pillSize = 10.5;
  const pillW = body.widthOfTextAtSize(pillText, pillSize) + 26;
  const pillH = 24;
  const pillX = PAGE_W - M - pillW;
  roundRect(page, pillX, headerMid + pillH / 2, pillW, pillH, pillH / 2, { borderColor: SAND, borderWidth: 1 });
  page.drawText(pillText, { x: pillX + 13, y: headerMid - pillSize * 0.35, size: pillSize, font: body, color: BROWN });

  const title = safe(heading, t.title);
  const titleSize = fitSize(heading, title, 24, pillX - 16 - hx, 14);
  page.drawText(title, { x: hx, y: headerMid - titleSize * 0.32, size: titleSize, font: heading, color: BROWN });

  page.drawLine({ start: { x: M, y: PAGE_H - headerH }, end: { x: PAGE_W - M, y: PAGE_H - headerH }, thickness: 1, color: LINE });

  // ===== Steps (a row of 5) =====
  const steps = t.steps(carrier);
  const colW = (PAGE_W - M * 2) / steps.length;
  const circleY = PAGE_H - headerH - 26;
  const subLines = steps.map(([, sub]) => wrapWidth(body, safe(body, sub), 8.5, colW - 10).slice(0, 2));
  const maxSubLines = Math.max(...subLines.map((l) => l.length));

  page.drawLine({
    start: { x: M + colW / 2, y: circleY },
    end: { x: PAGE_W - M - colW / 2, y: circleY },
    thickness: 1,
    color: LINE,
  });
  steps.forEach(([word], i) => {
    const cx = M + colW * i + colW / 2;
    page.drawCircle({ x: cx, y: circleY, size: 11, color: BROWN });
    centered(page, body, String(i + 1), cx, circleY - 3.6, 10, WHITE);
    centered(page, body, word, cx, circleY - 26, 10.5, INK);
    subLines[i].forEach((line, j) => {
      page.drawText(line, { x: cx - body.widthOfTextAtSize(line, 8.5) / 2, y: circleY - 38 - j * 10, size: 8.5, font: body, color: MUTED });
    });
  });
  const stepsBottom = circleY - 38 - (maxSubLines - 1) * 10;

  // ===== Packing slip card =====
  // Left: title + customer details. Right: barcode with the return code under it.
  const cardX = M;
  const cardW = PAGE_W - M * 2;
  const cardTop = stepsBottom - 18;
  const pad = 18;
  const barW = 150;
  const gutter = 24;
  const leftW = cardW - pad * 2 - barW - gutter;
  const colF = leftW / 3;

  const reasonLines = ret.reason ? wrapWidth(body, safe(body, String(ret.reason)), 11, leftW).slice(0, 2) : [];
  if (ret.reason && reasonLines.length === 2) {
    // Long reasons get trimmed so the page layout never breaks
    const all = wrapWidth(body, safe(body, String(ret.reason)), 11, leftW);
    if (all.length > 2) {
      let last = reasonLines[1];
      while (last.length > 1 && body.widthOfTextAtSize(last + "…", 11) > leftW) last = last.slice(0, -1);
      reasonLines[1] = last.trimEnd() + "…";
    }
  }

  const leftH = reasonLines.length ? 92 + (reasonLines.length - 1) * 13 + 4 : 66 + 4;
  const rightH = 72;
  const innerH = Math.max(leftH, rightH);
  const cardH = pad + innerH + pad;
  roundRect(page, cardX, cardTop, cardW, cardH, 12, { borderColor: LINE, borderWidth: 1 });

  const y0 = cardTop - pad;
  const lx = cardX + pad;

  text(page, heading, t.slipTitle, lx, y0 - 16, 19, BROWN);
  text(page, body, t.slipNote, lx, y0 - 30, 8.5, MUTED);

  const dateStr = new Date(ret.created_at).toLocaleDateString(t.locale, { year: "numeric", month: "short", day: "numeric" });
  const fields: [string, string][] = [
    [t.customer, ret.from_name || "—"],
    [t.returnDate, dateStr],
    [t.carrier, carrier],
  ];
  fields.forEach(([label, value], i) => {
    const fx = lx + colF * i;
    eyebrow(page, body, label, fx, y0 - 50);
    const v = safe(body, value);
    const vs = fitSize(body, v, 11.5, colF - 10, 9);
    page.drawText(v, { x: fx, y: y0 - 64, size: vs, font: body, color: INK });
  });

  if (reasonLines.length) {
    eyebrow(page, body, t.reason, lx, y0 - 80);
    reasonLines.forEach((line, i) => {
      page.drawText(line, { x: lx, y: y0 - 93 - i * 13, size: 11, font: body, color: INK });
    });
  }

  // Divider between the two sides
  const divX = lx + leftW + gutter / 2;
  page.drawLine({ start: { x: divX, y: y0 }, end: { x: divX, y: y0 - innerH }, thickness: 1, color: LINE });

  // Barcode block, centered top-to-bottom inside the card
  const barX = cardX + cardW - pad - barW;
  const barTop = y0 - (innerH - rightH) / 2;
  const codeText = safe(body, ret.return_code);
  if (barcode) {
    const bh = 46;
    page.drawImage(barcode, { x: barX, y: barTop - bh, width: barW, height: bh });
    page.drawText(codeText, {
      x: barX + barW / 2 - body.widthOfTextAtSize(codeText, 11) / 2,
      y: barTop - bh - 18,
      size: 11,
      font: body,
      color: INK,
    });
  } else {
    page.drawText(codeText, {
      x: barX + barW / 2 - body.widthOfTextAtSize(codeText, 16) / 2,
      y: barTop - rightH / 2 - 5,
      size: 16,
      font: body,
      color: INK,
    });
  }

  // Return address, small, under the card
  const addrY = cardTop - cardH - 14;
  text(page, body,
