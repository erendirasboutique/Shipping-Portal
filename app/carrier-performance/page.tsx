"use client";

// Carrier Performance — how fast each service actually delivers, by state,
// using the delivery dates saved by "Update tracking".

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/fetchAll";

type Range = 30 | 90 | 365;
const DAY = 864e5;

function serviceName(o: any) {
  return [o.carrier, o.mail_class].filter(Boolean).join(" ") || "Unknown";
}
// Days from first USPS scan (or when the label was bought) to delivery
function transitDays(o: any) {
  const start = o.first_scan_at || o.printed_at || o.created_at;
  if (!o.delivered_at || !start) return null;
  const d = (new Date(o.delivered_at).getTime() - new Date(start).getTime()) / DAY;
  return d >= 0 && d < 60 ? d : null;
}
function fmtDays(n: number) {
  return n.toFixed(1);
}
function money(n: number) {
  return "$" + n.toFixed(2);
}

export default function CarrierPerformancePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const sb = supabase as any;
  const [range, setRange] = useState<Range>(90);
  const [orders, setOrders] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [missingColumns, setMissingColumns] = useState(false);
  const [updating, setUpdating] = useState<{ done: number; total: number } | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [stateService, setStateService] = useState<string>("");

  async function load() {
    const since = new Date(Date.now() - 365 * DAY).toISOString();
    const rows = await fetchAll((from, to) =>
      sb
        .from("shipping_orders")
        .select("*")
        .not("tracking_number", "is", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .range(from, to)
    ).catch(() => [] as any[]);
    const live = rows.filter((o: any) => o.status !== "refunded");
    setMissingColumns(live.length > 0 && !("delivered_at" in live[0]));
    setOrders(live);
    setLoaded(true);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inRange = useMemo(() => {
    const cutoff = Date.now() - range * DAY;
    return orders.filter((o) => new Date(o.created_at).getTime() >= cutoff);
  }, [orders, range]);

  const delivered = useMemo(
    () => inRange.map((o) => ({ o, days: transitDays(o) })).filter((x): x is { o: any; days: number } => x.days != null),
    [inRange]
  );

  // Per service
  const services = useMemo(() => {
    const m = new Map<string, { name: string; days: number[]; costs: number[]; total: number }>();
    for (const o of inRange) {
      const k = serviceName(o);
      const s = m.get(k) || { name: k, days: [] as number[], costs: [] as number[], total: 0 };
      s.total++;
      if (o.postage_amount != null) s.costs.push(Number(o.postage_amount));
      m.set(k, s);
    }
    for (const { o, days } of delivered) m.get(serviceName(o))?.days.push(days);
    return Array.from(m.values())
      .map((s) => ({
        name: s.name,
        total: s.total,
        deliveredCount: s.days.length,
        avgDays: s.days.length ? s.days.reduce((a, b) => a + b, 0) / s.days.length : null,
        fastShare: s.days.length ? s.days.filter((d) => d <= 3).length / s.days.length : null,
        avgCost: s.costs.length ? s.costs.reduce((a, b) => a + b, 0) / s.costs.length : null,
      }))
      .sort((a, b) => b.total - a.total);
  }, [inRange, delivered]);

  // Cheaper vs faster tip (services with at least 5 deliveries)
  const tip = useMemo(() => {
    const ok = services.filter((s) => s.deliveredCount >= 5 && s.avgDays != null && s.avgCost != null);
    if (ok.length < 2) return null;
    const cheap = [...ok].sort((a, b) => a.avgCost! - b.avgCost!)[0];
    const fast = [...ok].sort((a, b) => a.avgDays! - b.avgDays!)[0];
    if (cheap.name === fast.name) return cheap.name + " is both the cheapest and the fastest lately. Easy choice.";
    const saves = cheap.avgDays! - fast.avgDays!;
    const costs = fast.avgCost! - cheap.avgCost!;
    if (saves <= 0) return null;
    return `${fast.name} saves about ${fmtDays(saves)} day${saves >= 1.05 || saves < 0.95 ? "s" : ""} but costs ${money(costs)} more per package than ${cheap.name}.`;
  }, [services]);

  // By state, for one service (default: the most used)
  const mainService = stateService || services[0]?.name || "";
  const byState = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const { o, days } of delivered) {
      if (mainService && serviceName(o) !== mainService) continue;
      const st = String(o.to_state || "").toUpperCase();
      if (!st) continue;
      m.set(st, [...(m.get(st) || []), days]);
    }
    return Array.from(m.entries())
      .map(([state, ds]) => ({ state, n: ds.length, avg: ds.reduce((a, b) => a + b, 0) / ds.length }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);
  }, [delivered, mainService]);
  const maxStateDays = Math.max(5, ...byState.map((s) => s.avg));
  const overallAvg = delivered.length ? delivered.reduce((a, b) => a + b.days, 0) / delivered.length : null;

  const slowest = useMemo(() => [...delivered].sort((a, b) => b.days - a.days).slice(0, 5), [delivered]);

  const busiestDay = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const { o } of delivered) counts[new Date(o.delivered_at).getDay()]++;
    const max = Math.max(...counts);
    if (!max) return null;
    const i = counts.indexOf(max);
    return { name: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i], share: max / delivered.length };
  }, [delivered]);

  const stillMoving = inRange.filter((o) => !o.delivered_at).length;

  // Ask EasyPost about every package that isn't marked delivered yet
  async function updateTracking() {
    setMsg(null);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return setMsg({ kind: "err", text: "Sign in with Google to update tracking." });

    const sixHours = Date.now() - 6 * 3600e3;
    const todo = orders
      .filter((o) => !o.delivered_at && o.tracking_number)
      .filter((o) => new Date(o.created_at).getTime() >= Date.now() - range * DAY)
      .filter((o) => !o.tracking_checked_at || new Date(o.tracking_checked_at).getTime() < sixHours)
      .slice(0, 300);
    if (!todo.length) return setMsg({ kind: "ok", text: "Everything here is already up to date." });

    setUpdating({ done: 0, total: todo.length });
    let newlyDelivered = 0;
    let failed = 0;
    for (let i = 0; i < todo.length; i += 25) {
      const chunk = todo.slice(i, i + 25);
      try {
        const res = await fetch("/api/tracking/check", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ items: chunk.map((o) => ({ id: o.id, tracking: o.tracking_number, carrier: o.carrier })) }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Tracking update failed.");
        for (const r of d.results || []) {
          if (!r.ok) {
            failed++;
            continue;
          }
          const patch: any = { tracking_status: r.status, tracking_checked_at: new Date().toISOString() };
          if (r.first_scan_at) patch.first_scan_at = r.first_scan_at;
          if (r.delivered_at) {
            patch.delivered_at = r.delivered_at;
            newlyDelivered++;
          }
          const { error } = await sb.from("shipping_orders").update(patch).eq("id", r.id);
          if (error) throw new Error(error.message);
        }
      } catch (e: any) {
        setUpdating(null);
        setMsg({ kind: "err", text: e.message });
        load();
        return;
      }
      setUpdating({ done: Math.min(i + 25, todo.length), total: todo.length });
    }
    setUpdating(null);
    setMsg({
      kind: "ok",
      text: `Checked ${todo.length} package${todo.length === 1 ? "" : "s"}: ${newlyDelivered} newly delivered` + (failed ? `, ${failed} couldn't be looked up.` : "."),
    });
    load();
  }

  return (
    <Shell>
      <div className="flex flex-col gap-4 md:gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">How fast it gets there</p>
            <h1 className="mt-1 text-4xl leading-[1.15] md:text-5xl">Carrier Performance</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" className="flex gap-1 rounded-full bg-sand/30 p-1">
              {([30, 90, 365] as Range[]).map((r) => (
                <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)}
                  className={`h-9 rounded-full px-4 text-sm ${range === r ? "bg-taupe text-cream" : "text-ink/60"}`}>
                  {r === 365 ? "This year" : r + " days"}
                </button>
              ))}
            </div>
            <button onClick={updateTracking} disabled={!!updating || missingColumns} className="btn-secondary">
              {updating ? `Updating ${updating.done}/${updating.total}…` : "Update tracking"}
            </button>
          </div>
        </div>

        {missingColumns && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            One-time setup needed: run <span className="font-mono">sql/tracking_columns.sql</span> in Supabase, then tap Update tracking.
          </p>
        )}
        {msg && (
          <p onClick={() => setMsg(null)} className={`cursor-pointer rounded-2xl px-4 py-3 text-sm ${msg.kind === "ok" ? "bg-sand/30 text-taupe" : "bg-red-50 text-red-700"}`}>
            {msg.text}
          </p>
        )}

        {/* Services */}
        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          {services.slice(0, 3).map((s) => (
            <div key={s.name} className="card flex flex-col gap-2.5 !rounded-3xl !p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[15px]">{s.name}</p>
                <span className="shrink-0 text-xs text-ink/55">{s.total} packages</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="py-1 font-heading text-5xl leading-[1.2] text-taupe">{s.avgDays != null ? fmtDays(s.avgDays) : "–"}</span>
                <span className="text-sm text-ink/55">days on average</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-sand/30">
                <div className="h-full rounded-full bg-taupe" style={{ width: s.avgDays != null ? Math.min(100, (s.avgDays / 6) * 100) + "%" : "0%" }} />
              </div>
              <div className="flex justify-between gap-2 text-[13px] text-ink/55">
                <span>{s.fastShare != null ? Math.round(s.fastShare * 100) + "% in 3 days or less" : "No deliveries yet"}</span>
                <span>{s.avgCost != null ? "avg " + money(s.avgCost) : ""}</span>
              </div>
            </div>
          ))}
          {loaded && !services.length && (
            <div className="card !rounded-3xl text-sm text-ink/55 md:col-span-3">No labels in this time range yet.</div>
          )}
        </div>

        {tip && (
          <div className="flex items-center gap-3 rounded-2xl bg-taupe px-5 py-3.5 text-[15px] text-cream">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
              <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
            </svg>
            {tip}
          </div>
        )}

        {loaded && !delivered.length && !missingColumns && (
          <div className="card !rounded-3xl text-center text-sm text-ink/60">
            No delivery dates saved yet. Tap <b className="font-normal text-taupe">Update tracking</b> to look them up. It can take a minute the first time.
          </div>
        )}

        <div className="grid gap-4 md:gap-5 lg:grid-cols-[1.2fr_1fr]">
          {/* By state */}
          <section className="card flex flex-col gap-3 !rounded-3xl !p-5 md:!rounded-[2rem] md:!p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl md:text-3xl">Days to deliver, by state</h2>
              {services.length > 1 && (
                <select value={mainService} onChange={(e) => setStateService(e.target.value)} className="input !w-auto !py-1.5 !text-xs" aria-label="Service">
                  {services.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              )}
            </div>
            {byState.map((s) => (
              <div key={s.state} className="grid grid-cols-[110px_1fr_56px] items-center gap-3 text-sm md:grid-cols-[130px_1fr_60px]">
                <span className="truncate">{s.state} <span className="text-ink/45">· {s.n}</span></span>
                <div className="h-3.5 overflow-hidden rounded-full bg-cream dark:bg-sand/20">
                  <div className={`h-full rounded-full ${overallAvg != null && s.avg > overallAvg + 1 ? "bg-sand" : "bg-taupe"}`} style={{ width: (s.avg / maxStateDays) * 100 + "%" }} />
                </div>
                <span className="text-right text-ink/60">{fmtDays(s.avg)} d</span>
              </div>
            ))}
            {!byState.length && <p className="text-sm text-ink/50">Shows up once packages have delivery dates.</p>}
          </section>

          <div className="flex flex-col gap-4 md:gap-5">
            {/* Slowest */}
            <section className="card flex flex-col gap-2.5 !rounded-3xl !p-5 md:!rounded-[2rem] md:!p-6">
              <h2 className="text-2xl md:text-3xl">Slowest lately</h2>
              {slowest.map(({ o, days }) => (
                <div key={o.id} className="flex items-center justify-between gap-3 border-b border-sand/30 pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-[15px]">{o.to_name}</p>
                    <p className="truncate text-[13px] text-ink/55">{[o.to_city, o.to_state].filter(Boolean).join(", ")} · {serviceName(o)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#fbf1dc] px-2.5 py-1 text-xs text-[#7a5a1e] dark:bg-transparent dark:text-[#e6c88f] dark:ring-1 dark:ring-[#e6c88f]/40">
                    {fmtDays(days)} days
                  </span>
                </div>
              ))}
              {!slowest.length && <p className="text-sm text-ink/50">Nothing yet.</p>}
            </section>

            {/* Delivery day + still moving */}
            <section className="grid grid-cols-2 gap-3">
              <div className="card flex flex-col gap-1 !rounded-3xl !p-5">
                <p className="text-xs text-ink/55">Most common delivery day</p>
                <p className="py-1 font-heading text-3xl leading-[1.2] text-taupe">{busiestDay?.name || "–"}</p>
                {busiestDay && <p className="text-xs text-ink/55">{Math.round(busiestDay.share * 100)}% of deliveries</p>}
              </div>
              <div className="card flex flex-col gap-1 !rounded-3xl !p-5">
                <p className="text-xs text-ink/55">Not delivered yet</p>
                <p className="py-1 font-heading text-3xl leading-[1.2] text-taupe">{loaded ? stillMoving : "–"}</p>
                <p className="text-xs text-ink/55">in this time range</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Shell>
  );
}
