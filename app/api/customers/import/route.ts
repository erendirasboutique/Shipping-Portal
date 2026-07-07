import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const pick = (r: Record<string, any>, keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
};

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows) || !rows.length) {
      return NextResponse.json({ error: "The CSV appears to be empty" }, { status: 400 });
    }

    let skipped = 0;
    const clean = rows
      .map((r: any) => {
        const first = pick(r, ["first_name", "firstname", "first"]);
        const last = pick(r, ["last_name", "lastname", "last"]);
        const name =
          pick(r, ["name", "full_name", "fullname", "customer_name", "customer", "recipient", "recipient_name", "ship_to", "contact"]) ||
          [first, last].filter(Boolean).join(" ");
        return {
          name,
          email: pick(r, ["email", "email_address", "e-mail"]).toLowerCase() || null,
          phone: pick(r, ["phone", "phone_number", "telephone", "mobile", "cell"]).replace(/\D/g, "") || null,
          street1: pick(r, ["street1", "street_1", "street", "address", "address1", "address_1", "address_line_1", "addr1"]) || null,
          street2: pick(r, ["street2", "street_2", "address2", "address_2", "address_line_2", "apt", "suite", "unit"]) || null,
          city: pick(r, ["city", "town"]) || null,
          state: pick(r, ["state", "province", "state_province", "st"]).toUpperCase() || null,
          zip: pick(r, ["zip", "zipcode", "zip_code", "postal", "postal_code", "postcode"]) || null,
          country: pick(r, ["country", "country_code"]).toUpperCase() || "US",
          notes: pick(r, ["notes", "note", "comments", "memo"]) || null,
        };
      })
      .filter((r) => {
        if (r.name) return true;
        skipped++;
        return false;
      });

    if (!clean.length) {
      const headers = Object.keys(rows[0] || {}).join(", ");
      return NextResponse.json(
        { error: `No rows had a usable name. Your CSV's columns are: ${headers}. Tell Claude these headers and it can map them.` },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin.from("shipping_customers").insert(clean).select("id");
    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      imported: data.length,
      skipped,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
