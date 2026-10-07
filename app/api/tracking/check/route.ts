// Looks up tracking for a small batch of labels through EasyPost and returns
// when each package was first scanned and when it was delivered.
// The page saves the results to the order; this route only talks to EasyPost.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Item = { id: string; tracking: string; carrier?: string | null };

const CARRIERS: Record<string, string> = { usps: "USPS", ups: "UPS", fedex: "FedEx", dhl: "DHLExpress" };

// Only signed-in portal users may use this (it can create EasyPost trackers).
async function signedIn(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!auth.startsWith("Bearer ") || !url || !anon) return false;
  try {
    const r = await fetch(url.replace(/\/$/, "") + "/auth/v1/user", { headers: { Authorization: auth, apikey: anon }, cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

async function track(item: Item, key: string) {
  const carrier = CARRIERS[String(item.carrier || "").toLowerCase()];
  const res = await fetch("https://api.easypost.com/v2/trackers", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(key + ":").toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tracker: { tracking_code: item.tracking, ...(carrier ? { carrier } : {}) } }),
    cache: "no-store",
  });
  const t = await res.json().catch(() => null);
  if (!res.ok || !t) {
    return { id: item.id, ok: false, error: t?.error?.message || "Tracking lookup failed" };
  }
  const details: any[] = Array.isArray(t.tracking_details) ? t.tracking_details : [];
  const firstScan = details.find((d) => d?.status && d.status !== "pre_transit" && d.status !== "unknown")?.datetime || null;
  const deliveredDetail = [...details].reverse().find((d) => d?.status === "delivered");
  const deliveredAt = t.status === "delivered" ? deliveredDetail?.datetime || t.updated_at || null : null;
  return {
    id: item.id,
    ok: true,
    status: t.status || null,
    first_scan_at: firstScan,
    delivered_at: deliveredAt,
    est_delivery_date: t.est_delivery_date || null,
  };
}

export async function POST(req: Request) {
  if (!(await signedIn(req))) {
    return NextResponse.json({ error: "Sign in to the portal (with Google) to update tracking." }, { status: 401 });
  }
  const key = process.env.EASYPOST_API_KEY;
  if (!key) return NextResponse.json({ error: "EASYPOST_API_KEY is not set in Vercel." }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const items: Item[] = (Array.isArray(body?.items) ? body.items : [])
    .filter((x: any) => x && x.id && x.tracking)
    .slice(0, 25);

  // A few at a time so EasyPost doesn't rate-limit us
  const results: any[] = [];
  for (let i = 0; i < items.length; i += 5) {
    const chunk = items.slice(i, i + 5);
    results.push(
      ...(await Promise.all(chunk.map((it) => track(it, key).catch(() => ({ id: it.id, ok: false, error: "Tracking lookup failed" })))))
    );
  }
  return NextResponse.json({ results });
}
