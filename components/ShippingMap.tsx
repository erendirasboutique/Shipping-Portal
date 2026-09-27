"use client";

// US map of where packages went. Map shapes load from a public CDN;
// package locations come from /api/map/points.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

declare global {
  interface Window {
    d3?: any;
    topojson?: any;
  }
}

type Point = { zip: string; city: string; state: string; lat: number; lng: number; count: number };
type MapData = {
  packages: number;
  unmapped: number;
  points: Point[];
  states: { state: string; count: number }[];
  topCities: { name: string; count: number }[];
};

const RANGES = [
  { id: "month", label: "This month" },
  { id: "3m", label: "3 months" },
  { id: "year", label: "This year" },
  { id: "all", label: "All time" },
];

// FIPS code → state abbreviation (us-atlas uses FIPS ids)
const FIPS: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC",
  "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT",
  "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY", "72": "PR",
};

function loadScript(src: string, globalName: "d3" | "topojson"): Promise<void> {
  if (typeof window !== "undefined" && window[globalName]) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-src="' + src + '"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("load")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("load"));
    document.head.appendChild(s);
  });
}

let shapesPromise: Promise<{ states: { id: string; d: string }[]; border: string }> | null = null;

function loadShapes() {
  if (!shapesPromise) {
    shapesPromise = (async () => {
      await loadScript("https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js", "d3");
      await loadScript("https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js", "topojson");
      const res = await fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json");
      const us = await res.json();
      const d3 = window.d3;
      const topojson = window.topojson;
      const path = d3.geoPath();
      const features = topojson.feature(us, us.objects.states).features;
      return {
        states: features.map((f: any) => ({ id: FIPS[String(f.id).padStart(2, "0")] || String(f.id), d: path(f) || "" })),
        border: path(topojson.mesh(us, us.objects.states, (a: any, b: any) => a !== b)) || "",
      };
    })().catch((e) => {
      shapesPromise = null;
      throw e;
    });
  }
  return shapesPromise;
}

export default function ShippingMap({ compact = false }: { compact?: boolean }) {
  const [range, setRange] = useState("month");
  const [data, setData] = useState<MapData | null>(null);
  const [shapes, setShapes] = useState<{ states: { id: string; d: string }[]; border: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hover, setHover] = useState<Point | null>(null);

  useEffect(() => {
    loadShapes()
      .then(setShapes)
      .catch(() => setErr("The map couldn't load. Check your connection and refresh."));
  }, []);

  useEffect(() => {
    let alive = true;
    setData(null);
    setHover(null);
    fetch("/api/map/points?range=" + range, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Couldn't load shipments.");
        if (alive) setData(d);
      })
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [range]);

  const projected = useMemo(() => {
    if (!shapes || !data || !window.d3) return [];
    const proj = window.d3.geoAlbersUsa().scale(1300).translate([487.5, 305]);
    return data.points
      .map((p) => {
        const xy = proj([p.lng, p.lat]);
        return xy ? { ...p, x: xy[0], y: xy[1] } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.count - a.count) as (Point & { x: number; y: number })[];
  }, [shapes, data]);

  const stateCounts = useMemo(() => {
    const m = new Map<string, number>();
    (data?.states || []).forEach((s) => m.set(s.state, s.count));
    return m;
  }, [data]);
  const maxState = Math.max(1, ...Array.from(stateCounts.values()));

  const radius = (n: number) => Math.min(18, 4 + Math.sqrt(n) * 2.6);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
              range === r.id ? "border-taupe bg-taupe text-cream dark:text-[#26211b]" : "border-taupe/30 text-taupe hover:bg-taupe/10"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-cream/70 px-4 py-3 dark:bg-transparent dark:ring-1 dark:ring-taupe/20">
          <p className="text-xs text-ink/60">Packages</p>
          <p className="font-heading text-3xl text-taupe">{data ? data.packages : "–"}</p>
        </div>
        <div className="rounded-2xl bg-cream/70 px-4 py-3 dark:bg-transparent dark:ring-1 dark:ring-taupe/20">
          <p className="text-xs text-ink/60">States</p>
          <p className="font-heading text-3xl text-taupe">{data ? data.states.length : "–"}</p>
        </div>
        <div className="rounded-2xl bg-cream/70 px-4 py-3 dark:bg-transparent dark:ring-1 dark:ring-taupe/20">
          <p className="text-xs text-ink/60">Top city</p>
          <p className="truncate pt-2 text-sm font-medium">{data?.topCities[0]?.name || "–"}</p>
        </div>
      </div>

      <div className="relative mt-4">
        {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
        {!err && (
          <svg viewBox="0 0 975 610" className="h-auto w-full" role="img" aria-label="Map of where packages were shipped">
            {shapes?.states.map((s) => {
              const n = stateCounts.get(s.id) || 0;
              return (
                <path
                  key={s.id}
                  d={s.d}
                  style={{
                    fill: n ? "rgb(var(--c-taupe) / " + (0.12 + 0.3 * (n / maxState)).toFixed(2) + ")" : "rgb(var(--c-sand) / 0.22)",
                  }}
                />
              );
            })}
            {shapes && <path d={shapes.border} fill="none" style={{ stroke: "rgb(var(--c-surface))" }} strokeWidth={1.2} strokeLinejoin="round" />}
            {projected.map((p) => (
              <circle
                key={p.zip}
                cx={p.x}
                cy={p.y}
                r={radius(p.count)}
                style={{ fill: "rgb(var(--c-taupe) / 0.8)", stroke: "rgb(var(--c-surface))" }}
                strokeWidth={1.5}
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(p)}
                className="cursor-pointer"
              />
            ))}
            {hover && (
              <circle cx={(hover as any).x} cy={(hover as any).y} r={radius(hover.count) + 4} fill="none" style={{ stroke: "rgb(var(--c-ink))" }} strokeWidth={2} pointerEvents="none" />
            )}
          </svg>
        )}
        {(!shapes || !data) && !err && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-ink/50">Loading map…</div>
        )}
        {data && shapes && !data.packages && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-ink/50">No shipments in this range yet.</div>
        )}
      </div>

      <p className="mt-2 min-h-[1.25rem] text-center text-sm text-ink/70">
        {hover
          ? hover.city + ", " + hover.state + " " + hover.zip + " · " + hover.count + (hover.count === 1 ? " package" : " packages")
          : compact
          ? ""
          : "Tap a dot to see the city."}
      </p>

      {!compact && data && data.packages > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="label">Top cities</p>
            <div className="space-y-1.5">
              {data.topCities.map((c) => (
                <div key={c.name} className="flex items-center justify-between rounded-xl border border-taupe/15 px-3.5 py-2 text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 text-taupe">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Top states</p>
            <div className="space-y-1.5">
              {data.states.slice(0, 5).map((s) => (
                <div key={s.state} className="flex items-center gap-3 rounded-xl border border-taupe/15 px-3.5 py-2 text-sm">
                  <span className="w-8 shrink-0 font-medium">{s.state}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand/30">
                    <span className="block h-full rounded-full bg-taupe" style={{ width: Math.round((s.count / data.states[0].count) * 100) + "%" }} />
                  </span>
                  <span className="w-8 shrink-0 text-right text-taupe">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {!compact && data && data.unmapped > 0 && (
        <p className="mt-3 text-xs text-ink/50">{data.unmapped} package{data.unmapped === 1 ? "" : "s"} had a ZIP code that couldn&apos;t be placed on the map.</p>
      )}
      {compact && (
        <Link href="/map" className="mt-2 inline-block text-sm text-taupe">Open full map →</Link>
      )}
    </div>
  );
}
