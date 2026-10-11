// app/api/live-list/[id]/route.ts
// Staff only.
//   PATCH  {name}  → fix a typo in the name
//   DELETE         → remove a row added by mistake (only before it has a
//                    label; throw away any stickers printed for it)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LIVE_LIST_SELECT, staffUser } from "@/lib/liveList";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await staffUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!name) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });

  const { data, error }: { data: any; error: any } = await supabaseAdmin()
    .from("live_list")
    .update({ name })
    .eq("id", params.id)
    .select(LIVE_LIST_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await staffUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const row: { data: any; error: any } = await db
    .from("live_list")
    .select("id, order_id")
    .eq("id", params.id)
    .maybeSingle();
  if (row.error) return NextResponse.json({ error: row.error.message }, { status: 500 });
  if (!row.data) return NextResponse.json({ ok: true });
  if (row.data.order_id) {
    return NextResponse.json(
      { error: "This one already has a shipping label, so it stays on the list." },
      { status: 409 }
    );
  }

  const { error } = await db.from("live_list").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
