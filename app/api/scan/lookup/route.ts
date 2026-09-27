// app/api/scan/lookup/route.ts
// Staff only. Finds the order for a scanned label.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { findOrderByCode, customerEmail, orderLabel } from "@/lib/scanLookup";
import { packageMessage, emailConfigured } from "@/lib/notify";

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
      },
      message: packageMessage(order.to_name, order.tracking_number),
      email: emailConfigured() ? email : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lookup failed." }, { status: 500 });
  }
}
