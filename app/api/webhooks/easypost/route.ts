// app/api/webhooks/easypost/route.ts
// EasyPost calls this every time a tracker changes (tracker.updated).
// Webhook URL in EasyPost:
//   https://EASYPOST_WEBHOOK_USER:EASYPOST_WEBHOOK_PASS@ship.erendirasboutique.com/api/webhooks/easypost
//
// Public route (see middleware). Every POST must carry the matching Basic auth.
import { NextResponse } from "next/server";
import { normalizeEasyPost, saveTrackingUpdate, validBasicAuth } from "@/lib/trackingWebhooks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!validBasicAuth(req.headers.get("authorization"), process.env.EASYPOST_WEBHOOK_USER, process.env.EASYPOST_WEBHOOK_PASS)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const update = normalizeEasyPost(body);
  if (!update) return NextResponse.json({ ok: true, ignored: true }); // other event types

  try {
    const updated = await saveTrackingUpdate(update);
    return NextResponse.json({ ok: true, updated });
  } catch (e: any) {
    console.error("[webhooks/easypost] save failed", update.trackingNumber, e?.message);
    return new Response("Save failed", { status: 500 }); // EasyPost retries failures
  }
}
