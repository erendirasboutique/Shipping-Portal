import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { code: raw } = await req.json();
    const code = String(raw || "").trim().toUpperCase();
    if (!code) return NextResponse.json({ error: "Enter your return code." }, { status: 400 });

    const admin = supabaseAdmin();

    const { data: rc } = await admin
      .from("return_codes")
      .select("code, used, expires_at")
      .eq("code", code)
      .maybeSingle();
    if (!rc) {
      return NextResponse.json({ error: "That return code wasn't found." }, { status: 404 });
    }

    const { data: rr } = await admin
      .from("return_requests")
      .select("status, label_url, tracking_number, tracking_url, carrier, mail_class, from_zip, from_name, created_at")
      .eq("return_code", code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!rr) {
      return NextResponse.json({
        state: "no_request",
        used: rc.used,
      });
    }

    return NextResponse.json({
      state: rr.label_url ? "label_ready" : "submitted",
      status: rr.status,
      first_name: (rr.from_name || "").split(" ")[0],
      label_url: rr.label_url,
      tracking_number: rr.tracking_number,
      tracking_url: rr.tracking_url,
      carrier: rr.carrier,
      mail_class: rr.mail_class,
      zip: rr.from_zip,
      submitted_at: rr.created_at,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
