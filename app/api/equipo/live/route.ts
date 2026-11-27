// app/api/equipo/live/route.ts
// Staff only. POST { sale_date?, title? }: start a new live sale from the
// stations' live picker. It copies the last live's settings (payment
// instructions, default shipping) and uses quick mode (photo + total, no
// item list), so nothing else needs setting up.

import { NextResponse } from "next/server";
import { staffUser } from "@/lib/liveList";
import { liveDb } from "@/lib/live/supabase";

export const dynamic = "force-dynamic";

function todayLA() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

export async function POST(req: Request) {
  const user = await staffUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.sale_date || "")) ? String(body.sale_date) : todayLA();
    const title = String(body.title || "").trim().slice(0, 80) || null;
    const db = liveDb();

    const { data: last } = await db
      .from("live_sales")
      .select("payment_instructions, payment_instructions_es, default_shipping_cents")
      .order("sale_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await db
      .from("live_sales")
      .insert({
        sale_date: date,
        title,
        status: "live",
        payment_instructions: (last as any)?.payment_instructions ?? null,
        payment_instructions_es: (last as any)?.payment_instructions_es ?? null,
        default_shipping_cents: (last as any)?.default_shipping_cents ?? 0,
        quick_mode: true,
      })
      .select("id, title, sale_date, status")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ sale: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
