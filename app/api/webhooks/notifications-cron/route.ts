// app/api/webhooks/notifications-cron/route.ts
// Vercel Cron (vercel.json) calls this every morning to send texts that were
// held overnight for quiet hours. Tracking webhooks also send them during the
// day, so this is the safety net.
//
// Public route (under /api/webhooks in middleware). Vercel sends
// "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set in Vercel.
import { NextResponse } from "next/server";
import { sendDueTexts } from "@/lib/customerNotify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  let total = 0;
  // A few rounds in case a lot piled up overnight.
  for (let i = 0; i < 8; i++) {
    const n = await sendDueTexts(25);
    total += n;
    if (n < 25) break;
  }
  return NextResponse.json({ ok: true, sent: total });
}
