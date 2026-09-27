// app/api/label-tools/route.ts
// Staff only. Powers the "Scan a Label" page.
//   GET  ?code=...                          → the order for a scanned label
//   POST {action:"rts", orderId, reason, note} → mark it returned to sender
//   POST {action:"undo_rts", orderId}          → clear that
//   POST {action:"reship", orderId}            → new draft with the same customer + package, ready to fix the address and buy
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findOrderByCode } from "@/lib/scanLookup";

export const dynamic = "force-dynamic";

const FIELDS =
  "id, order_number, customer_id, to_name, to_street1, to_street2, to_city, to_state, to_zip, to_country, to_phone, to_email, length, width, height, weight_lb, weight_oz, signature_confirmation, carrier, mail_class, tracking_number, tracking_url, postage_amount, status, refund_status, label_url, printed_at, printed_by, packed_at, customer_notified_at, created_at, rts_at, rts_by, rts_reason, reshipped_to, reship_of";

async function staff() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  return user;
}

async function loadFull(admin: any, id: string) {
  const { data, error } = await admin.from("shipping_orders").select(FIELDS).eq("id", id).single();
  if (error) {
    if (/column .*rts_/i.test(error.message)) {
      throw new Error("The database needs the Returned-to-sender update. Run supabase/label_tools.sql in Supabase.");
    }
    throw new Error(error.message);
  }
  let reshipLabel: string | null = null;
  if (data?.reshipped_to) {
    const { data: r } = await admin.from("shipping_orders").select("order_number, status").eq("id", data.reshipped_to).maybeSingle();
    if (r) reshipLabel = (r.order_number != null ? "EB-" + r.order_number : "new order") + (r.status === "draft" ? " (draft)" : "");
  }
  return { ...data, reship_label: reshipLabel };
}

export async function GET(req: Request) {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const code = new URL(req.url).searchParams.get("code") || "";
  if (!code.trim()) return NextResponse.json({ error: "Nothing was scanned." }, { status: 400 });
  try {
    const admin = supabaseAdmin();
    const hit = await findOrderByCode(admin, code);
    if (!hit) {
      return NextResponse.json(
        { error: "No order matches that label. Try again, or type the tracking or EB number." },
        { status: 404 }
      );
    }
    return NextResponse.json({ order: await loadFull(admin, hit.id) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lookup failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await staff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { action, orderId, reason, note } = await req.json();
    if (!orderId) return NextResponse.json({ error: "Missing order." }, { status: 400 });
    const admin = supabaseAdmin();

    if (action === "rts") {
      const text = [reason, note].filter((x: any) => x && String(x).trim()).join(" · ");
      const { error } = await admin
        .from("shipping_orders")
        .update({ rts_at: new Date().toISOString(), rts_by: user.email || null, rts_reason: text || null })
        .eq("id", orderId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ order: await loadFull(admin, orderId) });
    }

    if (action === "undo_rts") {
      const { error } = await admin.from("shipping_orders").update({ rts_at: null, rts_by: null, rts_reason: null }).eq("id", orderId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ order: await loadFull(admin, orderId) });
    }

    if (action === "reship") {
      const old = await loadFull(admin, orderId);
      if (old.reshipped_to) {
        // Already made one; send them back to it instead of making another.
        return NextResponse.json({ draftId: old.reshipped_to, existing: true });
      }
      const oldLabel = old.order_number != null ? "EB-" + old.order_number : "earlier order";
      const { data: draft, error } = await admin
        .from("shipping_orders")
        .insert({
          customer_id: old.customer_id,
          to_name: old.to_name,
          to_street1: old.to_street1,
          to_street2: old.to_street2,
          to_city: old.to_city,
          to_state: old.to_state,
          to_zip: old.to_zip,
          to_country: old.to_country || "US",
          to_phone: old.to_phone,
          to_email: old.to_email,
          length: old.length,
          width: old.width,
          height: old.height,
          weight_lb: old.weight_lb,
          weight_oz: old.weight_oz,
          signature_confirmation: old.signature_confirmation,
          status: "draft",
          notes: "Re-ship of " + oldLabel + " (returned to sender" + (old.rts_reason ? ": " + old.rts_reason : "") + ")",
          reship_of: old.id,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await admin.from("shipping_orders").update({ reshipped_to: draft.id }).eq("id", old.id);
      return NextResponse.json({ draftId: draft.id });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Something went wrong." }, { status: 500 });
  }
}
