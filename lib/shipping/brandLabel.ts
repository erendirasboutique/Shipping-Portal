// lib/shipping/brandLabel.ts
//
// Appends branded 4x6 label page(s) to an existing pdf-lib PDFDocument.
// Each raw carrier label (PDF, PNG, or JPG) is placed at full page size,
// then the broker watermark in the bottom-left corner is covered with a
// white mask and the boutique logo is stamped in its place.
//
// Barcodes, address block, and the bottom-right Data Matrix are untouched.
//
// The order's EB number (e.g. "EB-1234") is printed in the same strip,
// right-aligned, in the brand font (Silver Editorial, the packing slip
// heading font), so every package can be matched to its order at a glance.
//
// Used by /api/batch/merge for outbound labels. NOT used by the returns
// flow — return labels stay unbranded.

import { PDFDocument, PDFFont, PDFImage, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// ---------------------------------------------------------------------------
// Tuning constants — all values in PDF points. Page is 288 x 432 (4in x 6in).
// Origin is the BOTTOM-LEFT corner of the page.
// ---------------------------------------------------------------------------

const PAGE_W = 288; // 4in
const PAGE_H = 432; // 6in

// White rectangle covering the broker watermark (bottom-left strip).
// Inset so it never overlaps the label's printed lines: right of the left
// border (~x16), below the horizontal divider rule (~y44 top), above the
// bottom edge/border (~y10). Keep x + w well left of ~200pt so the Data
// Matrix on the bottom-right is never covered.
const MASK = { x: 22, y: 12, w: 165, h: 28 };

// Logo placement inside the masked area, scaled to fit while preserving
// aspect ratio, vertically centered within the mask.
const LOGO = { x: 26, maxW: 85, maxH: 22 };

// EB number, right-aligned inside the masked strip. Printed at `size`, and
// only shrinks (down to minSize) if a very long number wouldn't fit between
// the logo and the mask's right edge — so it never spills onto the Data Matrix.
const ORDER_NO = { size: 9, minSize: 7, padRight: 4, gapFromLogo: 6 };

// File in public/fonts. .otf (CFF) fonts are embedded whole — subsetting
// them can garble letters (same rule as the return slip).
export const ORDER_FONT_FILE = "sltfthesilvereditorial-regular.otf";

// Ligatures off — pdf-lib measures joined letters wrong (same as the slip).
const PLAIN_LETTERS = { liga: false, clig: false, dlig: false, hlig: false, calt: false, rlig: false };

// ---------------------------------------------------------------------------

/**
 * Embeds the font for the EB number. Call once per document. Pass the bytes
 * of ORDER_FONT_FILE; if they're missing or won't embed, falls back to
 * Helvetica so labels still print.
 */
export async function embedOrderFont(
  outDoc: PDFDocument,
  fontBytes: Uint8Array | null
): Promise<PDFFont> {
  if (fontBytes) {
    try {
      outDoc.registerFontkit(fontkit);
      return await outDoc.embedFont(fontBytes, { subset: false, features: PLAIN_LETTERS });
    } catch (e) {
      console.error("[brandLabel] custom font failed, using Helvetica", e);
    }
  }
  return outDoc.embedFont(StandardFonts.Helvetica);
}

/**
 * Embeds the logo once per output document. Pass the returned PDFImage to
 * subsequent appendBrandedLabel calls so the logo isn't re-embedded for
 * every label in a batch. Returns null if logoBytes is null (branding is
 * then skipped and labels are appended unmodified).
 */
export async function embedLogo(
  outDoc: PDFDocument,
  logoBytes: Uint8Array | null
): Promise<PDFImage | null> {
  if (!logoBytes) return null;
  return outDoc.embedPng(logoBytes);
}

export type OrderStamp = { text: string; font: PDFFont };

function stampBranding(
  page: ReturnType<PDFDocument["addPage"]>,
  logo: PDFImage | null,
  orderNo: OrderStamp | null
): void {
  page.drawRectangle({
    x: MASK.x,
    y: MASK.y,
    width: MASK.w,
    height: MASK.h,
    color: rgb(1, 1, 1),
  });

  let logoRight = MASK.x;
  if (logo) {
    const scale = Math.min(LOGO.maxW / logo.width, LOGO.maxH / logo.height);
    const logoW = logo.width * scale;
    const logoH = logo.height * scale;

    page.drawImage(logo, {
      x: LOGO.x,
      y: MASK.y + (MASK.h - logoH) / 2,
      width: logoW,
      height: logoH,
    });
    logoRight = LOGO.x + logoW;
  }

  if (orderNo && orderNo.text) {
    const { text, font } = orderNo;
    const right = MASK.x + MASK.w - ORDER_NO.padRight;
    const room = right - (logoRight + ORDER_NO.gapFromLogo);
    // Silver Editorial's hyphen sits tight against its neighbours, so
    // "EB-1234" reads as "EB1234". Draw it in pieces with a small gap on
    // each side of the hyphen instead.
    const parts = text.split("-");
    const gapFor = (sz: number) => sz * 0.12;
    const widthAt = (sz: number) =>
      parts.reduce((sum, p) => sum + font.widthOfTextAtSize(p, sz), 0) +
      (parts.length - 1) * (font.widthOfTextAtSize("-", sz) + 2 * gapFor(sz));

    let size = ORDER_NO.size;
    while (size > ORDER_NO.minSize && widthAt(size) > room) {
      size -= 0.5;
    }
    const h = font.heightAtSize(size, { descender: false });
    const y = MASK.y + (MASK.h - h) / 2;
    const gap = gapFor(size);
    let x = right - widthAt(size);
    parts.forEach((p, i) => {
      if (i > 0) {
        x += gap;
        page.drawText("-", { x, y, size, font, color: rgb(0, 0, 0) });
        x += font.widthOfTextAtSize("-", size) + gap;
      }
      page.drawText(p, { x, y, size, font, color: rgb(0, 0, 0) });
      x += font.widthOfTextAtSize(p, size);
    });
  }
}

/**
 * Appends one label to outDoc as branded 4x6 page(s).
 *
 * - PDF labels: every page of the label PDF becomes a branded 4x6 page.
 * - PNG/JPG labels: embedded as a single branded 4x6 page.
 * - If logo and orderNo are both null, pages are appended at 4x6 untouched.
 *
 * @param outDoc     The merged output document being built.
 * @param labelBytes Raw bytes of the carrier label.
 * @param logo       Logo embedded in outDoc via embedLogo(), or null.
 * @param orderNo    EB number to print (font from embedOrderFont()), or null.
 */
export async function appendBrandedLabel(
  outDoc: PDFDocument,
  labelBytes: Uint8Array,
  logo: PDFImage | null,
  orderNo: OrderStamp | null = null
): Promise<void> {
  const brand = logo || (orderNo && orderNo.text);
  const isPdf = labelBytes[0] === 0x25 && labelBytes[1] === 0x50; // "%P"
  const isPng = labelBytes[0] === 0x89 && labelBytes[1] === 0x50; // PNG magic

  if (isPdf) {
    const srcDoc = await PDFDocument.load(labelBytes);
    const indices = srcDoc.getPageIndices();
    const embeddedPages = await outDoc.embedPdf(srcDoc, indices);
    for (const embedded of embeddedPages) {
      const page = outDoc.addPage([PAGE_W, PAGE_H]);
      page.drawPage(embedded, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
      if (brand) stampBranding(page, logo, orderNo);
    }
  } else {
    const image = isPng
      ? await outDoc.embedPng(labelBytes)
      : await outDoc.embedJpg(labelBytes);
    const page = outDoc.addPage([PAGE_W, PAGE_H]);
    page.drawImage(image, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
    if (brand) stampBranding(page, logo, orderNo);
  }
}
