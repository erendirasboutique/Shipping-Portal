// app/api/broadcasts/presets/route.ts
// Staff only. GET the presets, POST { name, description?, message } to save one,
// DELETE ?id= to remove one you saved (built-in presets can't be deleted).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cleanMessage, staff } from "@/lib/broadcastApi";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin: any = supabaseAdmin();
  const { data, error } = await admin.from("message_presets").select("*").order("sort").order("created_at");
  if (error) return NextResponse.json({ error: "Run supabase/broadcasts.sql in the Supabase SQL Editor first.", needsSetup: true }, { status: 400 });
  return NextResponse.json({ presets: data || [] });
}

export async function POST(req: Request) {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 60);
  if (!name) return NextResponse.json({ error: "Give the preset a name." }, { status: 400 });
  const admin: any = supabaseAdmin();
  const { data, error } = await admin
    .from("message_presets")
    .insert({ name, description: String(body.description || "").slice(0, 120) || null, ...cleanMessage(body.message), built_in: false, sort: 100 })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ preset: data });
}

export async function DELETE(req: Request) {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const admin: any = supabaseAdmin();
  await admin.from("message_presets").delete().eq("id", id).eq("built_in", false);
  return NextResponse.json({ ok: true });
}
