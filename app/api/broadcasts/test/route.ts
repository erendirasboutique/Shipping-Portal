// app/api/broadcasts/test/route.ts
// Staff only. Sends what's on screen to you (name shows as "Chula").
import { NextResponse } from "next/server";
import { sendBroadcastTest } from "@/lib/broadcast";
import { cleanMessage, staff } from "@/lib/broadcastApi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const user = await staff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const channels = String(body.channels || "both");
  const email = channels !== "sms" ? String(body.email || user.email || "").trim() || null : null;
  const phone = channels !== "email" ? String(body.phone || "").trim() || null : null;
  if (!email && !phone) return NextResponse.json({ error: "Add your phone number to test a text." }, { status: 400 });
  const result = await sendBroadcastTest(cleanMessage(body.message), { email, phone });
  return NextResponse.json({ ok: true, result });
}
