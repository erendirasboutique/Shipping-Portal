import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 60;

// Merges the label PDFs for the given order ids into one PDF,
// marks them printed, and streams the merged PDF back.
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
      .select("id, label_url")
      .in("id", order_ids)
      .not("label_url", "is", null);
    if (error) throw new Error(error.message);
    if (!orders?.length) {
      return NextResponse.json({ error: "No purchased labels found for selection" }, { status: 400 });
    }

    const merged = await PDFDocument.create();
    for (const order of orders) {
      const res = await fetch(order.label_url!);
      if (!res.ok) continue;
      const bytes = await res.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
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
