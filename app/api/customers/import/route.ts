import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Accepts JSON: { rows: [{ name, email, phone, street1, street2, city, state, zip, country, notes }] }
export async function POST(req: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows) || !rows.length) {
      return NextResponse.json({ error: "No rows to import" }, { status: 400 });
    }

    const clean = rows
      .map((r: any) => ({
        name: (r.name || "").trim(),
        email: (r.email || "").trim().toLowerCase() || null,
        phone: (r.phone || "").replace(/\D/g, "") || null,
        street1: (r.street1 || r.address || "").trim() || null,
        street2: (r.street2 || "").trim() || null,
        city: (r.city || "").trim() || null,
        state: (r.state || "").trim().toUpperCase() || null,
        zip: (r.zip || r.postal_code || "").trim() || null,
        country: (r.country || "US").trim().toUpperCase(),
        notes: (r.notes || "").trim() || null,
      }))
      .filter((r) => r.name);

    if (!clean.length) {
      return NextResponse.json({ error: "No valid rows (name required)" }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin.from("shipping_customers").insert(clean).select("id");
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, imported: data.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
