// lib/shipping/brandLabel.ts
//
// Appends branded 4x6 label page(s) to an existing pdf-lib PDFDocument.
// Each raw carrier label (PDF, PNG, or JPG) is placed at full page size,
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
const LOGO = { x: 16, maxW: 90, maxH: 26 };

// ---------------------------------------------------------------------------

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

function stampBranding(
  page: ReturnType<PDFDocument["addPage"]>,
  logo: PDFImage
): void {
  page.drawRectangle({
    x: MASK.x,
    y: MASK.y,
    width: MASK.w,
    height: MASK.h,
    color: rgb(1, 1, 1),
  });

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

/**
 * Appends one label to outDoc as branded 4x6 page(s).
 *
 * - PDF labels: every page of the label PDF becomes a branded 4x6 page.
 * - PNG/JPG labels: embedded as a single branded 4x6 page.
 * - If logo is null, pages are appended at 4x6 without branding.
 *
 * @param outDoc     The merged output document being built.
 * @param labelBytes Raw bytes of the carrier label.
 * @param logo       Logo embedded in outDoc via embedLogo(), or null.
 */
export async function appendBrandedLabel(
  outDoc: PDFDocument,
  labelBytes: Uint8Array,
  logo: PDFImage | null
): Promise<void> {
  const isPdf = labelBytes[0] === 0x25 && labelBytes[1] === 0x50; // "%P"
  const isPng = labelBytes[0] === 0x89 && labelBytes[1] === 0x50; // PNG magic

  if (isPdf) {
    const srcDoc = await PDFDocument.load(labelBytes);
    const indices = srcDoc.getPageIndices();
    const embeddedPages = await outDoc.embedPdf(srcDoc, indices);
    for (const embedded of embeddedPages) {
      const page = outDoc.addPage([PAGE_W, PAGE_H]);
      page.drawPage(embedded, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
      if (logo) stampBranding(page, logo);
    }
  } else {
    const image = isPng
      ? await outDoc.embedPng(labelBytes)
      : await outDoc.embedJpg(labelBytes);
    const page = outDoc.addPage([PAGE_W, PAGE_H]);
    page.drawImage(image, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
    if (logo) stampBranding(page, logo);
  }
}
