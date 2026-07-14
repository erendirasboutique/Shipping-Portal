// lib/shipping/brandLabel.ts
//
// Appends a branded 4x6 label page to an existing pdf-lib PDFDocument.
// The raw carrier label (PNG, JPG, or PDF) is placed at full page size,
// then the broker watermark in the bottom-left corner is covered with a
// white mask and the boutique logo is stamped in its place.
//
// Barcodes, address block, and the bottom-right Data Matrix are untouched.
//
// Used by /api/batch/merge for outbound labels. NOT used by the returns
// flow — return labels stay unbranded.

import { PDFDocument, PDFImage, rgb } from "pdf-lib";

// ---------------------------------------------------------------------------
// Tuning constants — all values in PDF points. Page is 288 x 432 (4in x 6in).
// Origin is the BOTTOM-LEFT corner of the page.
// ---------------------------------------------------------------------------

const PAGE_W = 288; // 4in
const PAGE_H = 432; // 6in

// White rectangle covering the broker watermark (bottom-left strip).
// Keep x + w well left of ~200pt so the Data Matrix on the bottom-right
// is never covered.
const MASK = { x: 10, y: 6, w: 165, h: 42 };

// Logo placement inside the masked area, scaled to fit while preserving
// aspect ratio, vertically centered within the mask.
const LOGO = { x: 16, maxW: 120, maxH: 34 };

// ---------------------------------------------------------------------------

/**
 * Loads and embeds the logo once per output document. Pass the returned
 * PDFImage to subsequent appendBrandedLabelPage calls to avoid re-embedding
 * the logo for every label in a batch.
 */
export async function embedLogo(
  outDoc: PDFDocument,
  logoBytes: Uint8Array
): Promise<PDFImage> {
  return outDoc.embedPng(logoBytes);
}

/**
 * Appends one branded 4x6 page to outDoc.
 *
 * @param outDoc     The merged output document being built.
 * @param labelBytes Raw bytes of the carrier label (PNG, JPG, or PDF).
 * @param logo       Logo already embedded in outDoc via embedLogo().
 */
export async function appendBrandedLabelPage(
  outDoc: PDFDocument,
  labelBytes: Uint8Array,
  logo: PDFImage
): Promise<void> {
  const page = outDoc.addPage([PAGE_W, PAGE_H]);

  // 1. Place the raw label at full page size, detecting format by magic bytes
  const isPdf = labelBytes[0] === 0x25 && labelBytes[1] === 0x50; // "%P"
  const isPng = labelBytes[0] === 0x89 && labelBytes[1] === 0x50; // PNG magic

  if (isPdf) {
    const srcDoc = await PDFDocument.load(labelBytes);
    const [embedded] = await outDoc.embedPdf(srcDoc, [0]);
    page.drawPage(embedded, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  } else {
    const image = isPng
      ? await outDoc.embedPng(labelBytes)
      : await outDoc.embedJpg(labelBytes);
    page.drawImage(image, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  }

  // 2. White-out the broker watermark in the bottom-left corner
  page.drawRectangle({
    x: MASK.x,
    y: MASK.y,
    width: MASK.w,
    height: MASK.h,
    color: rgb(1, 1, 1),
  });

  // 3. Stamp the logo, scaled to fit, aspect ratio preserved
  const scale = Math.min(LOGO.maxW / logo.width, LOGO.maxH / logo.height);
  const logoW = logo.width * scale;
  const logoH = logo.height * scale;

  page.drawImage(logo, {
    x: LOGO.x,
    y: MASK.y + (MASK.h - logoH) / 2,
    width: logoW,
    height: logoH,
  });
}
