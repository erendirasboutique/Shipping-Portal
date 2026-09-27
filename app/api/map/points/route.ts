// app/api/map/points/route.ts
// Staff only. Where packages went, grouped by ZIP code, for the shipping map.
import { NextResponse } from "next/server";
import zipcodes from "zipcodes";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function startOf(range: string): string | null {
  const now = new Date();
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  if (range === "3m") return new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
  if (range === "year") return new Date(now.getFullYear(), 0, 1).toISOString();
  return null;
}

export async function GET(req: Request) {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const range = new URL(req.url).searchParams.get("range") || "month";
  const since = startOf(range);
  const admin = supabaseAdmin();

  // Page through everything (Supabase returns 1000 rows at a time).
  const rows: any[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    let q = admin
      .from("shipping_orders")
      .select("to_zip, to_city, to_state, status")
      .not("tracking_number", "is", null)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (since) q = q.gte("created_at", since);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  const byZip = new Map<string, { zip: string; city: string; state: string; lat: number; lng: number; count: number }>();
  const byState = new Map<string, number>();
  let packages = 0;
  let unmapped = 0;

  for (const r of rows) {
    if (String(r.status || "").toLowerCase() === "refunded") continue;
    packages++;
    const zip5 = String(r.to_zip || "").match(/\d{5}/)?.[0];
    const info = zip5 ? zipcodes.lookup(zip5) : undefined;
    const state = String(info?.state || r.to_state || "").toUpperCase().slice(0, 2);
    if (state) byState.set(state, (byState.get(state) || 0) + 1);
    if (!zip5 || !info || !Number.isFinite(info.latitude)) {
      unmapped++;
      continue;
    }
    const cur = byZip.get(zip5);
    if (cur) cur.count++;
    else
      byZip.set(zip5, {
        zip: zip5,
        city: info.city || r.to_city || "",
        state,
        lat: info.latitude,
        lng: info.longitude,
        count: 1,
      });
  }

  const points = Array.from(byZip.values()).sort((a, b) => b.count - a.count);

  const cityTotals = new Map<string, number>();
  for (const p of points) {
    const k = p.city + ", " + p.state;
    cityTotals.set(k, (cityTotals.get(k) || 0) + p.count);
  }
  const topCities = Array.from(cityTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  const states = Array.from(byState.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([state, count]) => ({ state, count }));

  return NextResponse.json({ range, packages, unmapped, points, states, topCities });
}
