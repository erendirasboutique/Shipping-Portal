// app/api/batch/merge/route.ts

import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appendBrandedLabel, embedLogo, embedOrderFont, ORDER_FONT_FILE } from "@/lib/shipping/brandLabel";
import fs from "fs/promises";
import path from "path";

export const maxDuration = 60;

// Merges the label PDFs for the given order ids into one PDF — each label
// stamped with the boutique logo over the broker watermark, and the order's
// EB number beside it — marks them printed, and streams the merged PDF back.

async function fetchLogoBytes(origin: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`${origin}/fallbw.png`, { cache: "force-cache" });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// The EB number's font. Read from disk like the return slip does; if the
// file isn't bundled with the function, fetch it from the site instead.
async function fetchOrderFontBytes(origin: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(
      await fs.readFile(path.join(process.cwd(), "public", "fonts", ORDER_FONT_FILE))
    );
  } catch {
    // fall through to fetching it
  }
  try {
    const res = await fetch(`${origin}/fonts/${ORDER_FONT_FILE}`, { cache: "force-cache" });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { order_ids, mark_printed = true } = await req.json();
    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json({ error: "No labels selected" }, { status: 400 });
    }
    const admin = supabaseAdmin();
    const { data: orders, error } = await admin
      .from("shipping_orders")
      .select("id, label_url, order_number")
      .in("id", order_ids)
      .not("label_url", "is", null);
    if (error) throw new Error(error.message);
    if (!orders?.length) {
      return NextResponse.json({ error: "No purchased labels found for selection" }, { status: 400 });
    }

    // Load the logo once for the whole batch. If it can't be loaded
    // (missing file, etc.), printing still works — labels just go out
    // unbranded rather than failing the batch.
    const origin = new URL(req.url).origin;
    const [logoBytes, fontBytes] = await Promise.all([
      fetchLogoBytes(origin),
      fetchOrderFontBytes(origin),
    ]);

    const merged = await PDFDocument.create();
    const logo = await embedLogo(merged, logoBytes);
    const orderFont = await embedOrderFont(merged, fontBytes);

    for (const order of orders) {
      const res = await fetch(order.label_url!);
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      const orderNo =
        order.order_number != null
          ? { text: "EB-" + order.order_number, font: orderFont }
          : null;
      await appendBrandedLabel(merged, bytes, logo, orderNo);
    }

    const out = await merged.save();
    if (mark_printed) {
      await admin
        .from("shipping_orders")
        .update({
          printed_at: new Date().toISOString(),
          print_status: "printed",
          printed_by: user.email,
          batch_selected: false,
        })
        .in("id", orders.map((o) => o.id));
    }
    return new NextResponse(Buffer.from(out), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="labels.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
