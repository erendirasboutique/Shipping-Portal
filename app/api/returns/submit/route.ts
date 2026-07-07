import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const b = await req.json();

    const code = String(b.code || "").trim().toUpperCase();
    const name = String(b.name || "").trim();
    const street1 = String(b.street1 || "").trim();
    const city = String(b.city || "").trim();
    const state = String(b.state || "").trim().toUpperCase();
    const zip = String(b.zip || "").trim();

    if (!code) return NextResponse.json({ error: "Enter your return code." }, { status: 400 });
    if (!name || !street1 || !city || !state || !zip) {
      return NextResponse.json({ error: "Fill in your name and full address." }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: rc } = await admin
      .from("return_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (!rc) {
      return NextResponse.json({ error: "That return code wasn't found. Double-check it and try again." }, { status: 400 });
    }
    if (rc.used) {
      return NextResponse.json({ error: "That return code has already been used. Contact us if you need help." }, { status: 400 });
    }
    if (rc.expires_at && new Date(rc.expires_at) < new Date()) {
      return NextResponse.json({ error: "That return code has expired. Contact us for a new one." }, { status: 400 });
    }

    const { error: insertErr } = await admin.from("return_requests").insert({
      return_code: rc.code,
      customer_id: rc.customer_id,
      order_id: rc.order_id,
      from_name: name,
      from_street1: street1,
      from_street2: String(b.street2 || "").trim() || null,
      from_city: city,
      from_state: state,
      from_zip: zip,
      from_country: "US",
      from_phone: String(b.phone || "").trim() || null,
      from_email: String(b.email || "").trim().toLowerCase() || null,
      reason: String(b.reason || "").trim() || null,
      status: "submitted",
    });
    if (insertErr) throw new Error(insertErr.message);

    await admin.from("return_codes").update({ used: true }).eq("id", rc.id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
