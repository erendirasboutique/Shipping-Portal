// app/api/live-list/link/route.ts
// Staff only. POST {number, order_id} → tie this week's Live List #number to
// a shipping order. Called by the create-label page after it saves/buys.
// Returns {linked:false} instead of erroring when nothing matches: the label
// is already bought, and a missing link shouldn't block shipping.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentWeekStart, staffUser } from "@/lib/liveList";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await staffUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const number = Number(body.number);
  const orderId = typeof body.order_id === "string" ? body.order_id : null;
  if (!Number.isInteger(number) || number < 1 || !orderId) {
    return NextResponse.json({ error: "number and order_id required" }, { status: 400 });
  }

  const { data, error }: { data: any; error: any } = await supabaseAdmin()
    .from("live_list")
    .update({ order_id: orderId })
    .eq("week_start", currentWeekStart())
    .eq("number", number)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ linked: Boolean(data), id: data?.id ?? null });
}
