// app/api/notifications/test/route.ts
// Staff only. Sends the saved version of one message to you, using a made-up order.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { STAGES, sendTest, type Stage } from "@/lib/customerNotify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const stage = body.stage as Stage;
  if (!STAGES.includes(stage)) return NextResponse.json({ error: "Pick a message." }, { status: 400 });
  const email = String(body.email || user.email || "").trim() || null;
  const phone = String(body.phone || "").trim() || null;
  try {
    const result = await sendTest(stage, { email, phone });
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Test failed." }, { status: 400 });
  }
}
