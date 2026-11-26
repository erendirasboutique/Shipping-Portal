// lib/trackingWebhooks.ts
// Shared logic for the Shippo and EasyPost tracking webhooks
// (app/api/webhooks/shippo and app/api/webhooks/easypost).
//
// Both providers' payloads are turned into one shape, then saved onto the
// matching shipping_orders row by tracking number. Statuses use EasyPost's
// words (pre_transit, in_transit, out_for_delivery, delivered, ...) because
// that's what /api/tracking/check already writes to tracking_status.

import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifyOrder, sendDueTexts, stageForStatus } from "@/lib/customerNotify";

export type TrackingEvent = {
  at: string | null;
  status: string;
  message: string;
  location: string | null;
};

export type TrackingUpdate = {
  provider: "shippo" | "easypost";
  test: boolean;
  trackingNumber: string;
  status: string;
  latestMessage: string | null;
  latestLocation: string | null;
  latestAt: string | null;
  eta: string | null;
  firstScanAt: string | null;
  deliveredAt: string | null;
  events: TrackingEvent[]; // newest first
};

// Shippo's statuses, in EasyPost's words.
const SHIPPO_STATUS: Record<string, string> = {
  PRE_TRANSIT: "pre_transit",
  TRANSIT: "in_transit",
  DELIVERED: "delivered",
  RETURNED: "return_to_sender",
  FAILURE: "failure",
  UNKNOWN: "unknown",
};

function place(loc: any): string | null {
  if (!loc) return null;
  const parts = [loc.city, loc.state].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// Newest first, no repeats (retries and full-history payloads resend old scans).
function tidy(events: TrackingEvent[]): TrackingEvent[] {
  const seen = new Set<string>();
  return events
    .filter((e) => {
      const k = `${e.at}|${e.status}|${e.message}|${e.location}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

function firstScan(events: TrackingEvent[]): string | null {
  const real = events.filter((e) => e.at && e.status !== "pre_transit" && e.status !== "unknown");
  return real.length ? real[real.length - 1].at : null;
}

// ---------- Shippo ----------
export function normalizeShippo(body: any): TrackingUpdate | null {
  if (!body || body.event !== "track_updated" || !body.data?.tracking_number) return null;
  const d = body.data;
  const cur = d.tracking_status || {};
  let status = SHIPPO_STATUS[cur.status] || "unknown";
  if (status === "in_transit" && cur.substatus?.code === "out_for_delivery") status = "out_for_delivery";

  const history: any[] = Array.isArray(d.tracking_history) ? d.tracking_history : [];
  const events = tidy(
    [...history, ...(cur.status ? [cur] : [])].map((e) => ({
      at: e.status_date || null,
      status: SHIPPO_STATUS[e.status] || "unknown",
      message: e.status_details || e.status || "",
      location: place(e.location),
    }))
  );
  return {
    provider: "shippo",
    test: !!body.test,
    trackingNumber: String(d.tracking_number),
    status,
    latestMessage: cur.status_details || null,
    latestLocation: place(cur.location),
    latestAt: cur.status_date || events[0]?.at || null,
    eta: d.eta || null,
    firstScanAt: firstScan(events),
    deliveredAt: status === "delivered" ? cur.status_date || null : null,
    events,
  };
}

// Only once Shippo's solutions team has turned on HMAC for the account.
// Header Shippo-Auth-Signature: t=<timestamp>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">
export function validShippoHmac(raw: string, header: string | null, secret: string | undefined): boolean {
  if (!header || !secret) return false;
  const parts: Record<string, string> = {};
  for (const p of header.split(",")) {
    const i = p.indexOf("=");
    if (i > 0) parts[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
  return safeEqual(expected, parts.v1);
}

// ---------- EasyPost ----------
export function normalizeEasyPost(body: any): TrackingUpdate | null {
  if (!body || body.object !== "Event" || body.description !== "tracker.updated") return null;
  const t = body.result;
  if (!t?.tracking_code) return null;
  const details: any[] = Array.isArray(t.tracking_details) ? t.tracking_details : [];
  const events = tidy(
    details.map((e) => ({
      at: e.datetime || null,
      status: e.status || "unknown",
      message: e.message || e.status || "",
      location: place(e.tracking_location),
    }))
  );
  const latest = events[0];
  return {
    provider: "easypost",
    test: t.mode === "test",
    trackingNumber: String(t.tracking_code),
    status: t.status || "unknown",
    latestMessage: latest?.message || null,
    latestLocation: latest?.location || null,
    latestAt: latest?.at || t.updated_at || null,
    eta: t.est_delivery_date || null,
    firstScanAt: firstScan(events),
    deliveredAt: t.status === "delivered" ? events.find((e) => e.status === "delivered")?.at || t.updated_at || null : null,
    events,
  };
}

// EasyPost is given https://USER:PASS@ship.erendirasboutique.com/api/webhooks/easypost
// and sends those back as a Basic Authorization header.
export function validBasicAuth(header: string | null, user: string | undefined, pass: string | undefined): boolean {
  if (!header || !header.startsWith("Basic ") || !user || !pass) return false;
  const got = Buffer.from(header.slice(6), "base64").toString("utf8");
  return safeEqual(got, `${user}:${pass}`);
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- Saving ----------
// Finds the order(s) with this tracking number and saves the update.
// Skips the write when it's older than what's saved (updates can arrive late),
// so retries and duplicates are harmless. Returns how many orders were updated.
export async function saveTrackingUpdate(u: TrackingUpdate): Promise<number> {
  const admin: any = supabaseAdmin();
  const { data: rows, error } = await admin
    .from("shipping_orders")
    .select("id, tracking_last_event_at, first_scan_at, delivered_at")
    .eq("tracking_number", u.trackingNumber);
  if (error) throw new Error(error.message);
  if (!rows?.length) return 0; // not one of our orders (or a provider test payload)

  let updated = 0;
  for (const row of rows) {
    if (row.tracking_last_event_at && u.latestAt && new Date(u.latestAt) < new Date(row.tracking_last_event_at)) continue;
    const patch: Record<string, any> = {
      tracking_status: u.status,
      tracking_checked_at: new Date().toISOString(),
      tracking_last_event: u.latestMessage,
      tracking_last_location: u.latestLocation,
      tracking_last_event_at: u.latestAt,
      tracking_eta: u.eta,
      tracking_events: u.events.slice(0, 50),
      tracking_source: u.provider,
    };
    if (!row.first_scan_at && u.firstScanAt) patch.first_scan_at = u.firstScanAt;
    if (!row.delivered_at && u.deliveredAt) patch.delivered_at = u.deliveredAt;
    const { error: upErr } = await admin.from("shipping_orders").update(patch).eq("id", row.id);
    if (upErr) throw new Error(upErr.message);
    updated++;

    // Emails/texts #2–4 (on the way, out for delivery, delivered).
    // Each one only goes out once, so webhook retries are harmless.
    const stage = stageForStatus(u.status);
    if (stage && !u.test) await notifyOrder(row.id, stage);
  }
  // Any texts that were waiting for 8am and are now due.
  await sendDueTexts().catch((e) => console.error("[sendDueTexts]", e?.message));
  return updated;
}
