// app/api/broadcasts/[id]/cancel/route.ts
// Staff only. Stops a send: everyone not reached yet is skipped.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { staff } from "@/lib/broadcastApi";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin: any = supabaseAdmin();
  await admin.from("broadcast_recipients").update({ status: "skipped", error: "cancelled" }).eq("broadcast_id", params.id).eq("status", "pending");
  await admin.from("broadcasts").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", params.id).eq("status", "sending");
  return NextResponse.json({ ok: true });
}
