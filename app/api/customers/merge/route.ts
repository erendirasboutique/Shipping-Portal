import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Merge duplicates into a primary customer:
// - re-point all orders, return codes, and return requests to the primary
// - archive duplicates with merged_into (soft delete, no hard delete)
export async function POST(req: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { primary_id, duplicate_ids } = await req.json();
    if (!primary_id || !Array.isArray(duplicate_ids) || duplicate_ids.length === 0) {
      return NextResponse.json({ error: "primary_id and duplicate_ids required" }, { status: 400 });
    }
    const dupes = duplicate_ids.filter((id: string) => id !== primary_id);
    if (!dupes.length) return NextResponse.json({ error: "Nothing to merge" }, { status: 400 });

    const admin = supabaseAdmin();

    const moves = [
      admin.from("shipping_orders").update({ customer_id: primary_id }).in("customer_id", dupes),
      admin.from("return_codes").update({ customer_id: primary_id }).in("customer_id", dupes),
      admin.from("return_requests").update({ customer_id: primary_id }).in("customer_id", dupes),
    ];
    for (const move of moves) {
      const { error } = await move;
      if (error) throw new Error(error.message);
    }

    const { error: archiveErr } = await admin
      .from("shipping_customers")
      .update({ archived: true, merged_into: primary_id })
      .in("id", dupes);
    if (archiveErr) throw new Error(archiveErr.message);

    return NextResponse.json({ ok: true, merged: dupes.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
