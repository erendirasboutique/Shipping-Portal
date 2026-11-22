// app/api/webhooks/shippo/route.ts
// Shippo calls this every time a package's tracking changes (track_updated).
// Webhook URL in Shippo: https://ship.erendirasboutique.com/api/webhooks/shippo?token=SHIPPO_WEBHOOK_TOKEN
//
// Public route (see middleware). Every POST must carry the token, or a valid
// HMAC signature once Shippo enables it (SHIPPO_HMAC_SECRET).
import { NextResponse } from "next/server";
import { normalizeShippo, saveTrackingUpdate, safeEqual, validShippoHmac } from "@/lib/trackingWebhooks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const raw = await req.text();
  const token = new URL(req.url).searchParams.get("token") || "";
  const expected = process.env.SHIPPO_WEBHOOK_TOKEN;
  const okToken = !!expected && safeEqual(token, expected);
  const okHmac = validShippoHmac(raw, req.headers.get("shippo-auth-signature"), process.env.SHIPPO_HMAC_SECRET);
  if (!okToken && !okHmac) return new Response("Unauthorized", { status: 401 });

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const update = normalizeShippo(body);
  if (!update) return NextResponse.json({ ok: true, ignored: true }); // other event types

  try {
    const updated = await saveTrackingUpdate(update);
    return NextResponse.json({ ok: true, updated });
  } catch (e: any) {
    console.error("[webhooks/shippo] save failed", update.trackingNumber, e?.message);
    return new Response("Save failed", { status: 500 }); // Shippo retries 5xx
  }
}
