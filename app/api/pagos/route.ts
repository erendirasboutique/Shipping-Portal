// app/api/pagos/route.ts
// Staff only (middleware requires sign-in). The Friday "Pagos" list:
// payments read from forwarded emails, each with suggested baskets, plus
// every basket still waiting for payment (for search and cash).

import { NextResponse } from "next/server";
import { liveDb } from "@/lib/live/supabase";
import { staffUser } from "@/lib/liveList";
import { suggest } from "@/lib/payments/inbound";
import { getOpenBaskets } from "@/lib/payments/openBaskets";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await staffUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const tab = url.searchParams.get("tab") === "done" ? "done" : "new";
    const db = liveDb();

    const q = db
      .from("inbound_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(tab === "done" ? 80 : 200);
    const { data: payments, error } =
      tab === "done" ? await q.in("status", ["confirmed", "ignored"]) : await q.eq("status", "new");
    if (error) throw new Error(error.message);

    const open = await getOpenBaskets();

    // Confirmed rows: show which basket they went to.
    const confirmedIds = (payments || []).map((p: any) => p.basket_id).filter(Boolean);
    const basketNumbers = new Map<string, number>();
    if (confirmedIds.length) {
      const { data: bs } = await db.from("baskets").select("id, basket_number").in("id", confirmedIds);
      (bs || []).forEach((b: any) => basketNumbers.set(b.id, b.basket_number));
    }

    const counts = await db
      .from("inbound_payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");

    return NextResponse.json(
      {
        payments: (payments || []).map((p: any) => ({
          ...p,
          basket_number: p.basket_id ? basketNumbers.get(p.basket_id) ?? null : null,
          suggestions: p.status === "new" && p.source !== "gmail_confirm" ? suggest(p, open) : [],
        })),
        open_baskets: open,
        new_count: counts.count ?? 0,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
