// app/api/returns/slip/route.ts
// GET /api/returns/slip?code=EB-XXXXXX
// Generates a printable branded return slip PDF the customer places inside the package.
// Available once the label is ready (or status approved).
//
// Dependencies (package.json):
//   "pdf-lib": "^1.17.1",
//   "@pdf-lib/fontkit": "^1.1.1"

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ====== CONFIG ======
const HEADING_FONT_FILE = "la-luxes-serif.woff2";
const BODY_FONT_FILE = "recoleta-regular.woff2";

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

async function loadFont(pdf: PDFDocument, filename: string): Promise<PDFFont | null> {
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), "public", "fonts", filename));
    return await pdf.embedFont(bytes, { subset: true });
  } catch {
    return null;
  }
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

  // ---------- Build PDF ----------
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const heading =
    (await loadFont(pdf, HEADING_FONT_FILE)) ??
    (await pdf.embedFont(StandardFonts.TimesRomanBold));
  const body =
    (await loadFont(pdf, BODY_FONT_FILE)) ??
    (await pdf.embedFont(StandardFonts.TimesRoman));

  const page = pdf.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();
  const M = 56;
  let y: number;

  // Cream header band
  page.drawRectangle({ x: 0, y: height - 150, width, height: 150, color: CREAM });
  page.drawText("Erendira's Boutique", {
    x: M, y: height - 78, size: 28, font: heading, color: TAUPE,
  });
  page.drawText("RETURN SLIP", {
    x: M, y: height - 104, size: 13, font: body, color: SAND,
  });
  page.drawText("Please place this slip inside your return package", {
    x: M, y: height - 124, size: 10, font: body, color: INK,
  });

  y = height - 150 - 36;

  const field = (labelText: string, value: string) => {
    page.drawText(labelText.toUpperCase(), { x: M, y, size: 8, font: body, color: SAND });
    y -= 14;
    page.drawText(value || "—", { x: M, y, size: 12, font: body, color: INK });
    y -= 26;
  };

  field("Return Code", ret.return_code);
  field("Name", ret.from_name || "");
  field("Email", ret.from_email || "");
  if (ret.from_city) field("Returning From", `${ret.from_city}, ${ret.from_state || ""}`.trim());
  field(
    "Date",
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  );
  if (ret.tracking_number) {
    field(
      `${ret.carrier || "USPS"} Tracking`,
      ret.tracking_number
    );
  }
  if (ret.reason) {
    page.drawText("REASON FOR RETURN", { x: M, y, size: 8, font: body, color: SAND });
    y -= 14;
    const reason = String(ret.reason);
    // simple wrap at ~90 chars
    const lines: string[] = [];
    let rest = reason;
    while (rest.length > 90) {
      let cut = rest.lastIndexOf(" ", 90);
      if (cut < 40) cut = 90;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut).trim();
    }
    lines.push(rest);
    for (const line of lines.slice(0, 4)) {
      page.drawText(line, { x: M, y, size: 11, font: body, color: INK });
      y -= 16;
    }
    y -= 12;
  }

  // Divider
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1, color: SAND });
  y -= 28;

  // Ship-to box
  page.drawRectangle({
    x: M, y: y - 82, width: width - M * 2, height: 100,
    color: CREAM, borderColor: SAND, borderWidth: 1,
  });
  page.drawText("SHIP YOUR RETURN TO", { x: M + 16, y: y - 4, size: 8, font: body, color: TAUPE });
  let ay = y - 24;
  for (const line of RETURN_ADDRESS) {
    page.drawText(line, { x: M + 16, y: ay, size: 12, font: body, color: INK });
    ay -= 17;
  }
  y -= 118;

  // Checklist
  page.drawText("BEFORE YOU SHIP", { x: M, y, size: 8, font: body, color: SAND });
  y -= 16;
  const steps = [
    "Place this slip inside the package with your item(s)",
    "Attach the prepaid return label to the outside of the package",
    "Drop off at any USPS location or hand to your mail carrier",
  ];
  for (const s of steps) {
    page.drawText(`•  ${s}`, { x: M + 6, y, size: 11, font: body, color: INK });
    y -= 18;
  }

  // Footer
  page.drawText("Questions? Visit my.erendirasboutique.com", {
    x: M, y: 48, size: 9, font: body, color: SAND,
  });

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // inline so it opens in a new tab for printing
      "Content-Disposition": `inline; filename="return-slip-${ret.return_code}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
