"use client";

// Monthly Recap — a one-page summary of any month: packages, postage,
// ship days, top states and customers, returns, and highlights.

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/fetchAll";

const DAY = 864e5;

function monthStart(y: number, m: number) {
  return new Date(y, m, 1);
}
function inMonth(iso: string | null | undefined, y: number, m: number) {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === y && d.getMonth() === m;
}
function money(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pctChange(now: number, before: number) {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}
function nameKey(n?: string | null) {
  return String(n || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function properName(n?: string | null) {
  const s = String(n || "").trim();
  if (!s) return "Customer";
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) return s;
  return s.toLowerCase().split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}
function initials(n?: string | null) {
  const p = String(n || "").trim().split(/\s+/).filter(Boolean);
  return p.length ? ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() : "?";
}
function reasonTag(reason?: string | null) {
  const r = String(reason || "").toLowerCase();
  if (!r.trim()) return "No reason given";
  if (/small|pequeñ|chic/.test(r)) return "Too small";
  if (/big|large|grande/.test(r)) return "Too big";
  if (/damag|dañ|roto|broken|ripped|hole/.test(r)) return "Damaged";
  if (/wrong|equivoc|incorrect/.test(r)) return "Wrong item";
  if (/color|colour/.test(r)) return "Color";
  if (/fit|talla|size/.test(r)) return "Fit";
  return "Other";
}
function transitDays(o: any) {
  const start = o.first_scan_at || o.printed_at || o.created_at;
  if (!o.delivered_at || !start) return null;
  const d = (new Date(o.delivered_at).getTime() - new Date(start).getTime()) / DAY;
  return d >= 0 && d < 60 ? d : null;
}
function csvCell(v: any) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export default function RecapPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const sb = supabase as any;
  const now = new Date();
  // Default to last month until the 5th, then this month
  const initial = now.getDate() <= 5 ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  const [ym, setYm] = useState({ y: initial.getFullYear(), m: initial.getMonth() });
  const [orders, setOrders] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [ords, rets] = await Promise.all([
        fetchAll((from, to) =>
          sb.from("shipping_orders").select("*").not("tracking_number", "is", null).order("created_at", { ascending: true }).range(from, to)
        ).catch(() => [] as any[]),
        fetchAll((from, to) =>
          sb.from("return_requests").select("*").order("created_at", { ascending: true }).range(from, to)
        ).catch(() => [] as any[]),
      ]);
      setOrders(ords.filter((o: any) => o.status !== "refunded"));
      setReturns(rets);
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prev = ym.m === 0 ? { y: ym.y - 1, m: 11 } : { y: ym.y, m: ym.m - 1 };
  const isFuture = monthStart(ym.y, ym.m) > now;
  const canGoNext = monthStart(ym.y, ym.m + 1) <= now;
  const title = monthStart(ym.y, ym.m).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const prevName = monthStart(prev.y, prev.m).toLocaleDateString("en-US", { month: "long" });

  const r = useMemo(() => {
    const month = orders.filter((o) => inMonth(o.created_at, ym.y, ym.m));
    const before = orders.filter((o) => inMonth(o.created_at, prev.y, prev.m));
    const sum = (list: any[]) => list.reduce((s, o) => s + Number(o.postage_amount || 0), 0);
    const postage = sum(month);
    const postagePrev = sum(before);
    const avg = month.length ? postage / month.length : 0;
    const avgPrev = before.length ? postagePrev / before.length : 0;

    const monthReturns = returns.filter((x) => inMonth(x.created_at, ym.y, ym.m));
    const prevReturns = returns.filter((x) => inMonth(x.created_at, prev.y, prev.m));

    // Packages per ship day
    const byDay = new Map<string, number>();
    for (const o of month) {
      const d = new Date(o.created_at);
      const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      byDay.set(key, (byDay.get(key) || 0) + 1);
    }
    let days = Array.from(byDay.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
    // Keep the chart readable: if there are many small days, show the 10 busiest in date order
    if (days.length > 10) days = [...days].sort((a, b) => b[1] - a[1]).slice(0, 10).sort(([a], [b]) => (a < b ? -1 : 1));
    const biggest = [...days].sort((a, b) => b[1] - a[1])[0];

    // Top states / customers
    const count = (keyOf: (o: any) => string) => {
      const m = new Map<string, { label: string; n: number }>();
      for (const o of month) {
        const k = keyOf(o);
        if (!k) continue;
        const cur = m.get(k) || { label: k, n: 0 };
        cur.n++;
        m.set(k, cur);
      }
      return Array.from(m.values()).sort((a, b) => b.n - a.n);
    };
    const states = count((o) => String(o.to_state || "").toUpperCase());
    const custMap = new Map<string, { label: string; n: number }>();
    for (const o of month) {
      const k = nameKey(o.to_name);
      if (!k) continue;
      const cur = custMap.get(k) || { label: properName(o.to_name), n: 0 };
      cur.n++;
      custMap.set(k, cur);
    }
    const customers = Array.from(custMap.values()).sort((a, b) => b.n - a.n);

    // New customers: first-ever package went out this month
    const firstSeen = new Map<string, string>();
    for (const o of orders) {
      const k = nameKey(o.to_name);
      if (k && !firstSeen.has(k)) firstSeen.set(k, o.created_at);
    }
    const newCustomers = Array.from(firstSeen.values()).filter((iso) => inMonth(iso, ym.y, ym.m)).length;

    // Returns by reason
    const reasonMap = new Map<string, number>();
    for (const x of monthReturns) reasonMap.set(reasonTag(x.reason), (reasonMap.get(reasonTag(x.reason)) || 0) + 1);
    const reasons = Array.from(reasonMap.entries()).sort((a, b) => b[1] - a[1]);

    // Delivery speed (only if tracking dates have been saved)
    const speed = (list: any[]) => {
      const ds = list.map(transitDays).filter((d): d is number => d != null);
      return ds.length >= 3 ? ds.reduce((a, b) => a + b, 0) / ds.length : null;
    };
    const avgDays = speed(month);
    const avgDaysPrev = speed(before);

    // Services
    const services = count((o) => [o.carrier, o.mail_class].filter(Boolean).join(" "));

    return {
      month, before, postage, postagePrev, avg, avgPrev, monthReturns, prevReturns,
      days, biggest, states, customers, newCustomers, reasons, avgDays, avgDaysPrev, services,
    };
  }, [orders, returns, ym.y, ym.m, prev.y, prev.m]);

  const highlights: string[] = [];
  if (r.month.length) {
    if (r.newCustomers) highlights.push(`${r.newCustomers} new customer${r.newCustomers === 1 ? "" : "s"} this month`);
    if (r.states.length) highlights.push(`Packages went to ${r.states.length} state${r.states.length === 1 ? "" : "s"}`);
    if (r.avgDays != null)
      highlights.push(
        `Average delivery ${r.avgDays.toFixed(1)} days` +
          (r.avgDaysPrev != null ? (r.avgDays < r.avgDaysPrev ? `, ${(r.avgDaysPrev - r.avgDays).toFixed(1)} faster than ${prevName}` : r.avgDays > r.avgDaysPrev ? `, ${(r.avgDays - r.avgDaysPrev).toFixed(1)} slower than ${prevName}` : "") : "")
      );
    if (r.avgPrev && Math.abs(r.avg - r.avgPrev) >= 0.05)
      highlights.push(`Postage per package went ${r.avg < r.avgPrev ? "down" : "up"} ${money(Math.abs(r.avg - r.avgPrev))}`);
    if (r.services[0]) highlights.push(`${Math.round((r.services[0].n / r.month.length) * 100)}% shipped with ${r.services[0].label}`);
  }

  const kpis = [
    { label: "Packages shipped", value: r.month.length.toLocaleString(), change: pctChange(r.month.length, r.before.length), goodUp: true },
    { label: "Postage spent", value: money(r.postage), change: pctChange(r.postage, r.postagePrev), goodUp: null },
    { label: "Avg per package", value: r.month.length ? money(r.avg) : "–", diff: r.avgPrev && r.month.length ? r.avg - r.avgPrev : null },
    { label: "Returns", value: r.monthReturns.length.toLocaleString(), rate: r.month.length ? (r.monthReturns.length / r.month.length) * 100 : null },
  ];

  const maxDay = Math.max(1, ...r.days.map(([, n]) => n));

  function downloadCsv() {
    const head = ["Order", "Date", "Customer", "City", "State", "Carrier", "Service", "Tracking", "Postage", "Delivered"];
    const rows = r.month.map((o) => [
      o.order_number != null ? "EB-" + o.order_number : "",
      new Date(o.created_at).toLocaleDateString("en-US"),
      o.to_name, o.to_city, o.to_state, o.carrier, o.mail_class, o.tracking_number,
      o.postage_amount != null ? Number(o.postage_amount).toFixed(2) : "",
      o.delivered_at ? new Date(o.delivered_at).toLocaleDateString("en-US") : "",
    ]);
    const csv = [head, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `shipping-recap-${ym.y}-${String(ym.m + 1).padStart(2, "0")}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const card = "card !rounded-3xl !p-5 md:!rounded-[2rem] md:!p-6";

  return (
    <Shell>
      <div className="flex flex-col gap-4 md:gap-5">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Monthly recap</p>
            <h1 className="mt-1 text-4xl leading-[1.15] md:text-6xl">{title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button onClick={() => setYm(prev)} aria-label="Previous month"
              className="grid h-11 w-11 place-items-center rounded-full border border-sand bg-white text-lg text-taupe hover:border-taupe dark:bg-transparent">‹</button>
            <button onClick={() => setYm(ym.m === 11 ? { y: ym.y + 1, m: 0 } : { y: ym.y, m: ym.m + 1 })} disabled={!canGoNext} aria-label="Next month"
              className="grid h-11 w-11 place-items-center rounded-full border border-sand bg-white text-lg text-taupe hover:border-taupe disabled:opacity-40 dark:bg-transparent">›</button>
            <button onClick={() => window.print()} className="btn-secondary">Print</button>
            <button onClick={downloadCsv} disabled={!r.month.length} className="btn-primary">Download CSV</button>
          </div>
        </div>

        {loaded && !r.month.length && (
          <div className={card + " text-center text-sm text-ink/60"}>{isFuture ? "This month hasn't started yet." : "No packages shipped this month."}</div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {kpis.map((k) => {
            let note = "";
            let good: boolean | null = null;
            if ("change" in k && k.change != null) {
              note = (k.change > 0 ? "+" : "") + k.change + "% vs " + prevName;
              good = k.goodUp ? k.change >= 0 : null;
            } else if ("diff" in k && k.diff != null) {
              note = (k.diff <= 0 ? "−" : "+") + money(Math.abs(k.diff)) + " vs " + prevName;
              good = k.diff <= 0;
            } else if ("rate" in k && k.rate != null) {
              note = k.rate.toFixed(1) + "% of packages";
            }
            return (
              <div key={k.label} className="card flex min-w-0 flex-col gap-1 !rounded-3xl !p-4 md:!p-5">
                <p className="truncate text-xs text-ink/60 md:text-[13px]">{k.label}</p>
                <p className={`whitespace-nowrap py-1 font-heading leading-[1.2] text-taupe ${k.value.length > 8 ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl"}`}>{loaded ? k.value : "–"}</p>
                <p className={`truncate text-xs ${good === true ? "text-taupe" : "text-ink/55"}`}>{loaded ? note || " " : " "}</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 md:gap-5 lg:grid-cols-[1.5fr_1fr]">
          {/* Ship days */}
          <section className={card + " flex flex-col gap-3"}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl md:text-3xl">Packages each ship day</h2>
              <span className="text-xs text-ink/55">{r.days.length} day{r.days.length === 1 ? "" : "s"}</span>
            </div>
            <div className="flex h-52 items-end gap-2 border-b border-sand/50 px-1 md:gap-4">
              {r.days.map(([d, n]) => (
                <div key={d} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-xs md:text-sm">{n}</span>
                  <div className={`w-full max-w-[90px] rounded-t-xl ${r.biggest?.[0] === d ? "bg-taupe" : "bg-sand"}`} style={{ height: Math.max(4, (n / maxDay) * 170) + "px" }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 px-1 md:gap-4">
              {r.days.map(([d]) => {
                const [y, m, dd] = d.split("-").map(Number);
                const dt = new Date(y, m - 1, dd);
                return (
                  <span key={d} className="min-w-0 flex-1 truncate text-center text-[11px] text-ink/55 md:text-xs">
                    {dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                );
              })}
            </div>
            {r.biggest && (
              <p className="text-sm text-ink/60">
                Biggest day:{" "}
                <span className="text-ink">
                  {(() => {
                    const [y, m, dd] = r.biggest[0].split("-").map(Number);
                    return new Date(y, m - 1, dd).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                  })()}{" "}
                  · {r.biggest[1]} packages
                </span>
              </p>
            )}
          </section>

          {/* Top states */}
          <section className={card + " flex flex-col gap-2"}>
            <h2 className="text-2xl md:text-3xl">Top states</h2>
            {r.states.slice(0, 6).map((s, i) => (
              <div key={s.label} className="grid grid-cols-[24px_1fr_auto] items-center gap-2 border-b border-sand/30 pb-2 text-[15px] last:border-0">
                <span className="text-ink/45">{i + 1}</span>
                <span>{s.label}</span>
                <span className="text-ink/55">{s.n}</span>
              </div>
            ))}
            {!r.states.length && <p className="text-sm text-ink/50">Nothing yet.</p>}
          </section>
        </div>

        <div className="grid gap-4 md:grid-cols-3 md:gap-5">
          {/* Top customers */}
          <section className={card + " flex flex-col gap-2.5"}>
            <h2 className="text-2xl md:text-3xl">Top customers</h2>
            {r.customers.slice(0, 5).map((c) => (
              <div key={c.label} className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand/30 text-xs text-taupe">{initials(c.label)}</span>
                <span className="min-w-0 flex-1 truncate text-[15px]">{c.label}</span>
                <span className="shrink-0 text-[13px] text-ink/55">{c.n} package{c.n === 1 ? "" : "s"}</span>
              </div>
            ))}
            {!r.customers.length && <p className="text-sm text-ink/50">Nothing yet.</p>}
          </section>

          {/* Returns */}
          <section className={card + " flex flex-col gap-2.5"}>
            <h2 className="text-2xl md:text-3xl">Returns</h2>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-4xl text-taupe">{r.monthReturns.length}</span>
              <span className="text-sm text-ink/55">
                {r.month.length ? ((r.monthReturns.length / r.month.length) * 100).toFixed(1) + "% of packages" : ""}
              </span>
            </div>
            {r.reasons.map(([why, n]) => (
              <div key={why} className="flex justify-between text-[15px]"><span>{why}</span><span className="text-ink/55">{n}</span></div>
            ))}
            {!r.reasons.length && <p className="text-sm text-ink/50">No returns this month.</p>}
          </section>

          {/* Highlights */}
          <section className="flex flex-col gap-2.5 rounded-3xl bg-taupe p-5 text-cream md:rounded-[2rem] md:p-6">
            <h2 className="text-2xl !text-cream md:text-3xl">Highlights</h2>
            {highlights.map((h) => (
              <p key={h} className="text-[15px] leading-snug">• {h}</p>
            ))}
            {!highlights.length && <p className="text-[15px] text-cream/80">Highlights show up once the month has packages.</p>}
          </section>
        </div>
      </div>
    </Shell>
  );
}
