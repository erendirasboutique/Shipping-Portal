// app/api/equipo/route.ts
// Staff only. GET ?sale=<id>: one live sale's baskets for the team
// stations, plus the week's numbers and the list of recent sales.

import { NextResponse } from "next/server";
import { staffUser } from "@/lib/liveList";
import { liveDb } from "@/lib/live/supabase";
import { pickSale, saleBaskets } from "@/lib/equipo/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await staffUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const { sale, sales } = await pickSale(new URL(req.url).searchParams.get("sale"));
    if (!sale) return NextResponse.json({ sale: null, sales: [], baskets: [], counts: null, pagos_new: 0 });

    const baskets = await saleBaskets(sale.id);
    const withCustomer = baskets.filter((b) => b.customer || b.sent);
    const counts = {
      total: withCustomer.length,
      sent: baskets.filter((b) => b.sent).length,
      paid: baskets.filter((b) => b.paid && !b.to_confirm).length,
      to_confirm: baskets.filter((b) => b.to_confirm).length,
      unpaid: baskets.filter((b) => b.status === "finalized").length,
    };

    const { count } = await liveDb()
      .from("inbound_payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");

    return NextResponse.json(
      { sale, sales, baskets, counts, pagos_new: count ?? 0 },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
