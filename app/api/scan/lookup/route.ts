// app/api/scan/lookup/route.ts
// Staff only. Finds the order for a scanned label.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findOrderByCode, customerEmail, orderLabel } from "@/lib/scanLookup";
import { emailConfigured } from "@/lib/notify";
import { shippingNotice } from "@/lib/shipNotice";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = new URL(req.url).searchParams.get("code") || "";
  if (!code.trim()) return NextResponse.json({ error: "Nothing was scanned." }, { status: 400 });

  try {
    const admin = supabaseAdmin();
    const order = await findOrderByCode(admin, code);
    if (!order) {
      return NextResponse.json(
        { error: "No order matches that label. Try scanning again, or type the tracking or EB number." },
        { status: 404 }
      );
    }
    const email = await customerEmail(admin, order);

    // Full address + label date for the shipping notification.
    const { data: full } = await admin
      .from("shipping_orders")
      .select("to_name, to_street1, to_street2, to_city, to_state, to_zip, carrier, mail_class, tracking_number, created_at")
      .eq("id", order.id)
      .maybeSingle();

    // Muse queue status (skipped quietly if the Muse database update isn't in yet).
    let muse: any = null;
    {
      const { data, error: museErr } = await admin
        .from("shipping_orders")
        .select("muse_status, muse_flag_reason, muse_queued_at")
        .eq("id", order.id)
        .maybeSingle();
      if (!museErr) muse = data;
    }
    return NextResponse.json({
      order: {
        id: order.id,
        label: orderLabel(order),
        name: order.to_name,
        place: [order.to_city, order.to_state].filter(Boolean).join(", "),
        tracking: order.tracking_number,
        carrier: [order.carrier, order.mail_class].filter(Boolean).join(" "),
        photo: order.package_photo_url,
        notifiedAt: order.customer_notified_at,
        notifiedVia: order.notified_via,
        museStatus: muse?.muse_status || null,
        museFlagReason: muse?.muse_flag_reason || null,
        museQueuedAt: muse?.muse_queued_at || null,
      },
      message: shippingNotice(full || order),
      email: emailConfigured() ? email : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lookup failed." }, { status: 500 });
  }
}
