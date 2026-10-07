// Builds branded packing slips as one PDF, right in the browser.
// Uses pdf-lib (already in the project) and loads fontkit from a CDN the first
// time, so your own font files in /public/fonts can be embedded.

import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";

export type SlipSize = "4x6" | "letter";

export type SlipSettings = {
  size: SlipSize;
  messageEs: string;
  messageEn: string;
  footer: string;
  returnsLine: string;
  showTracking: boolean;
  showReturns: boolean;
  blankLines: boolean;
};

export type SlipOrder = {
  id: string;
  order_number: number | null;
  created_at: string;
  to_name: string | null;
  to_street1: string | null;
  to_street2: string | null;
  to_city: string | null;
  to_state: string | null;
  to_zip: string | null;
  carrier: string | null;
  mail_class: string | null;
  tracking_number: string | null;
  slip_items?: string | null;
};

export const DEFAULT_SETTINGS: SlipSettings = {
  size: "4x6",
  messageEs: "Gracias por apoyar a nuestra pequeña boutique. ¡Esperamos que te encante todo!",
  messageEn: "Thank you for supporting our small boutique. We hope you love everything!",
  footer: "erendirasboutique.com · Envíos cada sábado",
  returnsLine: "¿Algo no quedó? Returns: returns.erendirasboutique.com",
  showTracking: true,
  showReturns: true,
  blankLines: true,
};

// Brand files (same ones the portal uses)
const HEADING_FONT = "/fonts/sltfthesilvereditorial-regular.otf";
const BODY_FONT = "/fonts/CooperLtBT-Regular.ttf";
const LOGO = "/EB_Logo_Fall BGBLANK.png";
const FONTKIT = "https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/+esm";

const C = {
  taupe: rgb(149 / 255, 127 / 255, 103 / 255),
  sand: rgb(207 / 255, 189 / 255, 169 / 255),
  ink: rgb(51 / 255, 43 / 255, 35 / 255),
  muted: rgb(125 / 255, 111 / 255, 99 / 255),
  cream: rgb(245 / 255, 243 / 255, 239 / 255),
};

export function orderLabel(o: SlipOrder) {
  return o.order_number != null ? "EB-" + o.order_number : "Order";
}
export function properName(n?: string | null) {
  const s = String(n || "").trim();
  if (!s) return "Customer";
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) return s;
  return s.toLowerCase().split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}
export function firstName(n?: string | null) {
  return properName(n).split(" ")[0] || "";
}
export function itemsOf(o: SlipOrder) {
  return String(o.slip_items || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

type Fonts = { heading: PDFFont; body: PDFFont; custom: boolean };

let fontkitPromise: Promise<any> | null = null;
function loadFontkit() {
  if (!fontkitPromise) {
    const importFromUrl = new Function("u", "return import(u)") as (u: string) => Promise<any>;
    fontkitPromise = importFromUrl(FONTKIT).then((m) => m.default || m).catch((e) => {
      fontkitPromise = null;
      throw e;
    });
  }
  return fontkitPromise;
}

async function fetchBytes(url: string) {
  const r = await fetch(encodeURI(url));
  if (!r.ok) throw new Error("missing " + url);
  return new Uint8Array(await r.arrayBuffer());
}

async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  try {
    const fontkit = await loadFontkit();
    doc.registerFontkit(fontkit);
    const [h, b] = await Promise.all([fetchBytes(HEADING_FONT), fetchBytes(BODY_FONT)]);
    return { heading: await doc.embedFont(h), body: await doc.embedFont(b), custom: true };
  } catch {
    // Fall back to built-in fonts so slips still print
    return {
      heading: await doc.embedFont(StandardFonts.TimesRoman),
      body: await doc.embedFont(StandardFonts.TimesRoman),
      custom: false,
    };
  }
}

async function loadLogo(doc: PDFDocument): Promise<PDFImage | null> {
  try {
    return await doc.embedPng(await fetchBytes(LOGO));
  } catch {
    return null;
  }
}

// Built-in fonts can't draw characters outside Latin-1 (like emoji)
function clean(text: string, fonts: Fonts) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return fonts.custom ? t.replace(/[\uD800-\uDFFF]/g, "").replace(/[\u2600-\u27BF\uFE0F]/g, "").trim() : t.replace(/[^\x20-\xFF]/g, "").trim();
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(test, size) <= maxW || !line) line = test;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawSlip(page: PDFPage, o: SlipOrder, st: SlipSettings, f: Fonts, logo: PDFImage | null) {
  const W = page.getWidth();
  const H = page.getHeight();
  const s = st.size === "letter" ? 1.9 : 1; // scale the 4×6 design up for letter paper
  const m = 18 * s;
  const inner = W - m * 2;
  let y = H - m;

  const text = (t: string, x: number, yy: number, size: number, font: PDFFont, color = C.ink) => {
    const v = clean(t, f);
    if (v) page.drawText(v, { x, y: yy, size, font, color });
  };
  const right = (t: string, yy: number, size: number, font: PDFFont, color = C.ink) => {
    const v = clean(t, f);
    if (v) page.drawText(v, { x: W - m - font.widthOfTextAtSize(v, size), y: yy, size, font, color });
  };
  const spaced = (t: string) => t.toUpperCase().split("").join(" ");

  // Logo
  if (logo) {
    const lh = 38 * s;
    let lw = logo.width * (lh / logo.height);
    let h = lh;
    if (lw > inner * 0.6) {
      h = lh * ((inner * 0.6) / lw);
      lw = inner * 0.6;
    }
    page.drawImage(logo, { x: (W - lw) / 2, y: y - h, width: lw, height: h });
    y -= h + 9 * s;
  } else {
    const name = "Erendira's Boutique";
    const sz = 18 * s;
    text(name, (W - f.heading.widthOfTextAtSize(name, sz)) / 2, y - sz, sz, f.heading, C.taupe);
    y -= sz + 10 * s;
  }
  page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.8 * s, color: C.sand });
  y -= 15 * s;

  // Title row
  text(spaced("Packing slip"), m, y, 5.6 * s, f.body, C.taupe);
  right(new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), y, 6.5 * s, f.body, C.muted);
  y -= 20 * s;
  text(orderLabel(o), m, y, 20 * s, f.heading, C.taupe);
  y -= 16 * s;

  // Ship to
  text(spaced("Ship to"), m, y, 5.4 * s, f.body, C.taupe);
  y -= 11 * s;
  const addr = [
    properName(o.to_name),
    [o.to_street1, o.to_street2].filter(Boolean).join(", "),
    [[o.to_city, o.to_state].filter(Boolean).join(", "), o.to_zip].filter(Boolean).join(" "),
  ].filter((x) => x && x.trim());
  addr.forEach((line, i) => {
    for (const l of wrap(clean(line, f), f.body, (i === 0 ? 9 : 7.6) * s, inner)) {
      text(l, m, y, (i === 0 ? 9 : 7.6) * s, f.body, i === 0 ? C.ink : C.muted);
      y -= (i === 0 ? 11 : 9.5) * s;
    }
  });

  if (st.showTracking && (o.mail_class || o.tracking_number)) {
    y -= 2 * s;
    const via = [o.carrier, o.mail_class].filter(Boolean).join(" ");
    text((via ? via : "Tracking") + (o.tracking_number ? " · " + o.tracking_number : ""), m, y, 6.3 * s, f.body, C.muted);
    y -= 9 * s;
  }
  y -= 6 * s;

  // Bottom part first (footer + thank-you), so items get whatever space is left
  let bottom = m;
  const footerSize = 6 * s;
  if (st.footer.trim()) {
    const v = clean(st.footer, f);
    text(v, (W - f.body.widthOfTextAtSize(v, footerSize)) / 2, bottom, footerSize, f.body, C.taupe);
    bottom += 10 * s;
  }
  if (st.showReturns && st.returnsLine.trim()) {
    for (const l of wrap(clean(st.returnsLine, f), f.body, 6.2 * s, inner).reverse()) {
      text(l, (W - f.body.widthOfTextAtSize(l, 6.2 * s)) / 2, bottom, 6.2 * s, f.body, C.muted);
      bottom += 8.5 * s;
    }
  }
  bottom += 6 * s;

  // Thank-you box
  const pad = 10 * s;
  const hello = "¡Gracias, " + (firstName(o.to_name) || "amiga") + "!";
  const esLines = st.messageEs.trim() ? wrap(clean(st.messageEs, f), f.body, 7.2 * s, inner - pad * 2) : [];
  const enLines = st.messageEn.trim() ? wrap(clean(st.messageEn, f), f.body, 6.5 * s, inner - pad * 2) : [];
  const boxH = pad * 2 + 15 * s + esLines.length * 9 * s + (enLines.length ? 3 * s + enLines.length * 8.2 * s : 0);
  page.drawRectangle({ x: m, y: bottom, width: inner, height: boxH, color: C.sand, opacity: 0.28 });
  page.drawRectangle({ x: m, y: bottom, width: 2.4 * s, height: boxH, color: C.taupe });
  let by = bottom + boxH - pad - 12 * s;
  text(hello, m + pad, by, 13 * s, f.heading, C.taupe);
  by -= 13 * s;
  for (const l of esLines) {
    text(l, m + pad, by, 7.2 * s, f.body, C.ink);
    by -= 9 * s;
  }
  if (enLines.length) by -= 3 * s;
  for (const l of enLines) {
    text(l, m + pad, by, 6.5 * s, f.body, C.muted);
    by -= 8.2 * s;
  }
  const itemsFloor = bottom + boxH + 10 * s;

  // Items
  page.drawLine({ start: { x: m, y: y + 2 * s }, end: { x: W - m, y: y + 2 * s }, thickness: 0.5 * s, color: C.sand });
  y -= 10 * s;
  text(spaced("En tu paquete · In your package"), m, y, 5.4 * s, f.body, C.taupe);
  y -= 13 * s;

  const items = itemsOf(o);
  const rowH = 12.5 * s;
  const box = 6.2 * s;
  const rows = items.length ? items : st.blankLines ? ["", "", "", "", ""] : [];
  const fits = Math.max(0, Math.floor((y - itemsFloor) / rowH) + 1);
  const show = rows.length > fits ? rows.slice(0, Math.max(0, fits - 1)) : rows;
  for (const it of show) {
    page.drawRectangle({ x: m, y: y - 1 * s, width: box, height: box, borderColor: C.taupe, borderWidth: 0.6 * s });
    if (it) {
      const l = wrap(clean(it, f), f.body, 7.6 * s, inner - box - 6 * s)[0] || "";
      text(l, m + box + 6 * s, y, 7.6 * s, f.body, C.ink);
    } else {
      page.drawLine({ start: { x: m + box + 6 * s, y: y - 1 * s }, end: { x: W - m, y: y - 1 * s }, thickness: 0.4 * s, color: C.sand });
    }
    y -= rowH;
  }
  if (rows.length > show.length) text("+" + (rows.length - show.length) + " more", m + box + 6 * s, y, 7 * s, f.body, C.muted);
  if (!rows.length) text("—", m, y, 8 * s, f.body, C.muted);
}

export async function buildPackingSlips(orders: SlipOrder[], settings: SlipSettings): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Packing slips · Erendira's Boutique");
  const [fonts, logo] = await Promise.all([loadFonts(doc), loadLogo(doc)]);
  const size: [number, number] = settings.size === "letter" ? [612, 792] : [288, 432];
  for (const o of orders) {
    const page = doc.addPage(size);
    drawSlip(page, o, settings, fonts, logo);
  }
  return await doc.save();
}
