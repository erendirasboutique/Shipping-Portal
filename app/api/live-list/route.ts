// app/api/live-list/route.ts
// Staff only.
//   GET               → this week's Live List, oldest first, with linked orders
//   POST {name}       → add a package; it gets the next number for the week
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentWeekStart, LIVE_LIST_SELECT, staffUser } from "@/lib/liveList";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await staffUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const week = currentWeekStart();
  const { data, error }: { data: any[] | null; error: any } = await supabaseAdmin()
    .from("live_list")
    .select(LIVE_LIST_SELECT)
    .eq("week_start", week)
    .order("number", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ week, rows: data ?? [] });
}

export async function POST(req: Request) {
  if (!(await staffUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!name) return NextResponse.json({ error: "Type the customer's name first." }, { status: 400 });
  if (name.length > 120) return NextResponse.json({ error: "That name is too long." }, { status: 400 });

  const db = supabaseAdmin();
  const week = currentWeekStart();

  // Next number = highest this week + 1. Two people adding at the same
  // moment could pick the same number; the unique index catches it and we
  // simply try the next one.
  for (let attempt = 0; attempt < 5; attempt++) {
    const top: { data: any; error: any } = await db
      .from("live_list")
      .select("number")
      .eq("week_start", week)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (top.error) return NextResponse.json({ error: top.error.message }, { status: 500 });

    const number = (top.data?.number ?? 0) + 1;
    const ins: { data: any; error: any } = await db
      .from("live_list")
      .insert({ week_start: week, number, name })
      .select(LIVE_LIST_SELECT)
      .single();

    if (!ins.error) return NextResponse.json({ row: ins.data });
    if (ins.error.code !== "23505") {
      return NextResponse.json({ error: ins.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Couldn't get a number. Try again." }, { status: 409 });
}
