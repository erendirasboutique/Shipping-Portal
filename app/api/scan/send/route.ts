// app/api/scan/send/route.ts
// Staff only. Saves the package photo on the order, and records how the
// customer was told: shared on Messenger from the phone, or emailed from here.
//   mode = "shared" → photo saved, marked as sent on Messenger
//   mode = "email"  → photo saved, emailed to the customer
//   mode = "save"   → photo saved only
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { customerEmail, orderLabel } from "@/lib/scanLookup";
import { sendEmailPackage, emailConfigured } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = "package-photos";
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const orderId = String(form.get("orderId") || "");
    const mode = String(form.get("mode") || "save");
    const photo = form.get("photo");
    if (!orderId) return NextResponse.json({ error: "Missing order." }, { status: 400 });

    const admin = supabaseAdmin();
    const { data: order, error: loadErr } = await admin
      .from("shipping_orders")
      .select("id, order_number, customer_id, to_name, to_email, tracking_number, package_photo_url")
      .eq("id", orderId)
      .single();
    if (loadErr || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    let photoUrl: string | null = order.package_photo_url || null;
    if (photo && typeof photo !== "string") {
      const file = photo as File;
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "That photo is too large. Try again." }, { status: 413 });
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = order.id + "/" + crypto.randomUUID() + ".jpg";
      const up = await admin.storage.from(BUCKET).upload(path, bytes, {
        contentType: file.type || "image/jpeg",
        upsert: false,
        cacheControl: "31536000",
      });
      if (up.error) {
        const msg = /bucket not found/i.test(up.error.message)
          ? "The package-photos storage bucket is missing. Run supabase/scan_send_map.sql in Supabase."
          : up.error.message;
        return NextResponse.json({ error: msg }, { status: 500 });
      }
      photoUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }

    const now = new Date().toISOString();
    const update: any = { package_photo_url: photoUrl, packed_at: now, packed_by: user.email || null, updated_at: now };
    let to = "";

    if (mode === "email") {
      const email = await customerEmail(admin, order);
      if (!email) return NextResponse.json({ error: "This customer has no email on file." }, { status: 400 });
      if (!emailConfigured()) return NextResponse.json({ error: "Email isn't set up yet." }, { status: 400 });
      await sendEmailPackage({
        to: email,
        name: order.to_name,
        photoUrl,
        trackingNumber: order.tracking_number,
        orderLabel: orderLabel(order),
      });
      update.customer_notified_at = now;
      update.notified_via = "email";
      to = email;
    } else if (mode === "shared") {
      update.customer_notified_at = now;
      update.notified_via = "messenger";
    }

    await admin.from("shipping_orders").update(update).eq("id", order.id);
    return NextResponse.json({ ok: true, via: mode, to, photoUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Saving failed." }, { status: 500 });
  }
}
