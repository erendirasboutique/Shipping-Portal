// app/api/live-list/lookup/route.ts
// Staff only. GET ?n=14 → Live List #14 for this week, the shipping order
// it's linked to (if any), and the saved customers whose name matches, so
// the create-label page can fill the address in.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentWeekStart, ebNumber, LIVE_LIST_SELECT, staffUser } from "@/lib/liveList";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await staffUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const n = Number(new URL(req.url).searchParams.get("n"));
  if (!Number.isInteger(n) || n < 1) {
    return NextResponse.json({ error: "Type the number from the sticker." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const week = currentWeekStart();

  const row: { data: any; error: any } = await db
    .from("live_list")
    .select(LIVE_LIST_SELECT)
    .eq("week_start", week)
    .eq("number", n)
    .maybeSingle();
  if (row.error) return NextResponse.json({ error: row.error.message }, { status: 500 });
  if (!row.data) {
    return NextResponse.json({
      found: false,
      reason: `#${n} isn't on this week's Live List. Check the number on the sticker.`,
    });
  }

  // Customers whose saved name matches. Exact (case-insensitive) matches
  // first; the page fills the address in only when there's exactly one.
  const name: string = row.data.name;
  const like = name.replace(/[%_,()]/g, " ").trim();
  const cust: { data: any[] | null; error: any } = await db
    .from("shipping_customers")
    .select("*")
    .eq("archived", false)
    .ilike("name", `%${like}%`)
    .limit(6);
  const customers = (cust.data ?? []).sort(
    (a, b) =>
      Number((b.name ?? "").toLowerCase() === name.toLowerCase()) -
      Number((a.name ?? "").toLowerCase() === name.toLowerCase())
  );
  const exact = customers.filter((c) => (c.name ?? "").toLowerCase() === name.toLowerCase());

  const order = row.data.order;
  return NextResponse.json({
    found: true,
    row: { id: row.data.id, number: row.data.number, name },
    order: order
      ? {
          id: order.id,
          order_number: ebNumber(order.order_number),
          has_label: Boolean(order.label_url || order.tracking_number),
          tracking_number: order.tracking_number,
        }
      : null,
    customer: exact.length === 1 ? exact[0] : null,
    candidates: customers,
  });
}
