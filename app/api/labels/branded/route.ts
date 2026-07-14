// app/api/labels/branded/route.ts
//
// Takes a carrier label (EasyPost or Shippo, PNG or PDF) and returns a 4x6 PDF
// with the broker watermark in the bottom-left corner covered by your logo
// (public/logo2.png). Nothing else on the label is altered — barcodes,
// address block, and the bottom-right Data Matrix stay untouched.
//
// Usage:
//   GET /api/labels/branded?url=<encoded label url>
//
// Example:
//   /api/labels/branded?url=https%3A%2F%2Feasypost-files.s3.us-west-2.amazonaws.com%2F...label.png
//
// Dependencies: pdf-lib (already used by the returns PDF system)
//   npm install pdf-lib

import { NextRequest } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Tuning constants — all values in PDF points. Page is 288 x 432 (4in x 6in).
// Origin is the BOTTOM-LEFT corner of the page.
// ---------------------------------------------------------------------------

const PAGE_W = 288; // 4in
const PAGE_H = 432; // 6in

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// White rectangle that covers the broker watermark (bottom-left strip).
// Keep MASK.x + MASK.w well left of ~200pt so the Data Matrix on the
// bottom-right is never covered.
const MASK: Box = {
  x: 10,
  y: 6,
  w: 165,
  h: 42,
};

// Logo placement inside the masked area. The logo is scaled to fit within
// maxW x maxH while preserving its aspect ratio.
const LOGO = {
  x: 16,
  maxW: 120,
  maxH: 34,
};

// Only fetch labels from hosts we trust (prevents this route being used to
// fetch arbitrary URLs). Add hosts here if your label URLs come from elsewhere.
const ALLOWED_LABEL_HOSTS: string[] = [
  "easypost-files.s3.us-west-2.amazonaws.com",
  "easypost-files.s3-us-west-2.amazonaws.com",
  "assets.easypost.com",
  "shippo-delivery-east.s3.amazonaws.com",
  "shippo-delivery.s3.amazonaws.com",
  "deliver.goshippo.com",
];

// ---------------------------------------------------------------------------

function hostAllowed(urlString: string): boolean {
  try {
    const { hostname, protocol } = new URL(urlString);
    if (protocol !== "https:") return false;
    return ALLOWED_LABEL_HOSTS.some(
      (h) => hostname === h || hostname.endsWith(`.${h}`)
    );
  } catch {
    return false;
  }
}

async function fetchLogoBytes(origin: string): Promise<Uint8Array> {
  // Served from public/logo2.png on the same deployment.
  const res = await fetch(`${origin}/logo2.png`, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`Could not load logo2.png (status ${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const labelUrl = searchParams.get("url");

  if (!labelUrl) {
    return Response.json(
      { error: "Missing ?url= query parameter with the label URL." },
      { status: 400 }
    );
  }

  if (!hostAllowed(labelUrl)) {
    return Response.json(
      { error: "Label URL host is not on the allowed list." },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch the raw label
    const labelRes = await fetch(labelUrl);
    if (!labelRes.ok) {
      return Response.json(
        { error: `Failed to fetch label (status ${labelRes.status}).` },
        { status: 502 }
      );
    }
    const contentType = (
      labelRes.headers.get("content-type") || ""
    ).toLowerCase();
    const labelBytes = new Uint8Array(await labelRes.arrayBuffer());

    // 2. Build the 4x6 output page
    const outDoc = await PDFDocument.create();
    const page = outDoc.addPage([PAGE_W, PAGE_H]);

    // 3. Place the label at full page size
    const isPdf =
      contentType.includes("pdf") ||
      (labelBytes[0] === 0x25 && labelBytes[1] === 0x50); // "%P"

    if (isPdf) {
      const srcDoc = await PDFDocument.load(labelBytes);
      const [embedded] = await outDoc.embedPdf(srcDoc, [0]);
      page.drawPage(embedded, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
    } else {
      const isPng =
        contentType.includes("png") ||
        (labelBytes[0] === 0x89 && labelBytes[1] === 0x50); // PNG magic bytes
      const image = isPng
        ? await outDoc.embedPng(labelBytes)
        : await outDoc.embedJpg(labelBytes);
      page.drawImage(image, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
    }

    // 4. White-out the broker watermark in the bottom-left corner
    page.drawRectangle({
      x: MASK.x,
      y: MASK.y,
      width: MASK.w,
      height: MASK.h,
      color: rgb(1, 1, 1),
    });

    // 5. Stamp the logo, scaled to fit, aspect ratio preserved
    const logoBytes = await fetchLogoBytes(origin);
    const logoImage = await outDoc.embedPng(logoBytes);
    const scale = Math.min(
      LOGO.maxW / logoImage.width,
      LOGO.maxH / logoImage.height
    );
    const logoW = logoImage.width * scale;
    const logoH = logoImage.height * scale;

    page.drawImage(logoImage, {
      x: LOGO.x,
      // Vertically center the logo within the masked strip
      y: MASK.y + (MASK.h - logoH) / 2,
      width: logoW,
      height: logoH,
    });

    // 6. Return the branded 4x6 PDF
    const pdfBytes = await outDoc.save();

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="branded-label.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Branded label generation failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: "Failed to generate branded label.", detail },
      { status: 500 }
    );
  }
}
