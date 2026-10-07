"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/fetchAll";
import ShippingMap from "@/components/ShippingMap";
import ShipDayCard from "@/components/ShipDayCard";

const Flower = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden>
    {[0, 90, 180, 270].map((r) => (
      <ellipse key={r} cx="20" cy="11" rx="6" ry="9" fill="currentColor" transform={`rotate(${r} 20 20)`} />
    ))}
    <circle cx="20" cy="20" r="4" fill="currentColor" />
  </svg>
);

function shortWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function money(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Dashboard() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [stats, setStats] = useState({ today: 0, customers: 0, purchased: 0, drafts: 0, queue: 0, postage: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [today, customers, purchased, drafts, queue, postageRows, recentRows] = await Promise.all([
        supabase.from("shipping_orders").select("id", { count: "exact", head: true })
          .eq("status", "purchased").gte("created_at", startOfDay.toISOString()),
        supabase.from("shipping_customers").select("id", { count: "exact", head: true }).eq("archived", false),
        supabase.from("shipping_orders").select("id", { count: "exact", head: true }).not("tracking_number", "is", null),
        supabase.from("shipping_orders").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("shipping_orders").select("id", { count: "exact", head: true })
          .eq("status", "purchased").eq("print_status", "not_printed"),
        // Every purchased label's postage (loaded 1,000 at a time; voided labels don't count).
        fetchAll((from, to) =>
          supabase
            .from("shipping_orders")
            .select("postage_amount, status")
            .not("postage_amount", "is", null)
            .order("id", { ascending: true })
            .range(from, to)
        ).then(
          (rows) => ({ data: rows.filter((r: any) => r.status !== "refunded") }),
          () => ({ data: [] as any[] })
        ),
        supabase.from("shipping_orders").select("to_name, carrier, mail_class, created_at")
          .not("tracking_number", "is", null).order("created_at", { ascending: false }).limit(7),
      ]);
      setStats({
        today: today.count ?? 0,
        customers: customers.count ?? 0,
        purchased: purchased.count ?? 0,
        drafts: drafts.count ?? 0,
        queue: queue.count ?? 0,
        postage: (postageRows.data ?? []).reduce((s: number, r: any) => s + Number(r.postage_amount || 0), 0),
      });
      setRecent(recentRows.data ?? []);
      setLoaded(true);
    })();
  }, [supabase]);

  const statCards = [
    { label: "Today's Shipments", value: stats.today.toLocaleString(), sub: "Created today", href: "/orders" },
    { label: "Print Queue", value: stats.queue.toLocaleString(), sub: "Ready to print", href: "/batch-print" },
    { label: "Pending Labels", value: stats.drafts.toLocaleString(), sub: "Drafts/rates ready", href: "/orders" },
    { label: "Customers", value: stats.customers.toLocaleString(), sub: "Saved profiles", href: "/customers" },
    { label: "Labels Purchased", value: stats.purchased.toLocaleString(), sub: "All-time purchased", href: "/orders" },
    { label: "Postage Spent", value: money(stats.postage), sub: "Purchased postage", href: "/orders" },
  ];

  const tiles = [
    { href: "/packing", title: "Packing List", desc: "See what's packed and what's left this week", cta: "Open" },
    { href: "/scan", title: "Scan & Send", desc: "Scan packed labels, snap a photo, message the customer", cta: "Open" },
    { href: "/batch-print", title: "Batch Print", desc: "Combine selected purchased labels into one PDF", cta: "Open" },
    { href: "/customers", title: "Customers", desc: "Import CSV, edit addresses, merge duplicates", cta: "Manage" },
    { href: "/orders", title: "Orders", desc: "Review shipments, tracking, refunds, labels", cta: "View" },
  ];

  return (
    <Shell>
      {/* Hero */}
      <div className="card relative overflow-hidden !rounded-3xl border-l-[6px] !border-l-taupe/70 !p-5 md:!rounded-[2rem] md:!p-8">
        <Flower className="absolute -right-3 -top-3 w-14 text-sand/35 md:w-20" />
        <Flower className="absolute right-16 top-10 hidden w-10 text-sand/25 md:block" />
        <Flower className="absolute -bottom-4 right-6 hidden w-14 text-sand/20 md:block" />
        <div className="relative flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="eyebrow">Shipping Studio</p>
            <h1 className="mt-1 text-4xl leading-[1.15] md:text-6xl">Shipping Portal</h1>
            <p className="mt-3 text-sm text-ink/70">
              Create 4×6 labels, manage customers, review shipments, and print batches.
            </p>
          </div>
          <div className="stamp relative hidden shrink-0 sm:block">
            <Flower className="absolute -right-4 -top-4 w-10 text-sand/40" />
            <p className="text-sm text-ink/70">Today</p>
            <p className="font-heading text-6xl text-taupe">{stats.today}</p>
            <p className="text-xs text-ink/60">shipments created</p>
          </div>
        </div>

        {/* Phone: the main action right in the hero */}
        <Link
          href="/create-label"
          className="mt-5 flex items-center justify-between rounded-2xl bg-taupe px-5 py-4 text-cream md:hidden"
        >
          <span className="font-heading text-2xl text-cream">Create a Label</span>
          <span className="text-sm">Start →</span>
        </Link>
      </div>

      {/* Ship day: weather, USPS holidays, alerts where packages are headed */}
      <ShipDayCard />

      {/* Stat cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:mt-5 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
        {statCards.map((s) => (
          <Link key={s.label} href={s.href} className="card min-w-0 !rounded-2xl !p-4 transition-colors hover:border-taupe/40 md:!rounded-3xl md:!p-5">
            <p className="truncate text-xs text-ink/70">{s.label}</p>
            <p className={`mt-1 whitespace-nowrap py-1 font-heading leading-[1.2] text-taupe md:mt-1.5 ${s.value.length > 7 ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl"}`}>
              {loaded ? s.value : "–"}
            </p>
            <p className="mt-1.5 truncate text-[11px] text-ink/50 md:mt-2 md:text-xs">{s.sub}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:mt-5 md:gap-5 xl:grid-cols-2">
        {/* Quick actions */}
        <div className="card !rounded-3xl !p-5 md:!rounded-[2rem] md:!p-8">
          <p className="eyebrow">Start here</p>
          <h2 className="mt-1 text-3xl md:text-5xl">Quick Actions</h2>

          <Link
            href="/create-label"
            className="group mt-6 hidden rounded-[1.75rem] bg-taupe p-7 text-cream transition-colors hover:bg-[#87715a] md:block"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="font-heading text-4xl text-cream">Create a Label</p>
              <span className="shrink-0 text-sm">
                Start <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </span>
            </div>
            <p className="mt-2 text-sm text-cream/90">Search customer, choose rate, buy 4×6 PDF</p>
          </Link>

          {/* Two-across on phones, stacked rows on bigger screens */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-4">
            {tiles.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="tile group flex min-h-[96px] flex-col justify-between !rounded-2xl !p-4 last:col-span-2 md:min-h-0 md:!rounded-3xl md:!p-7 md:last:col-span-1"
              >
                <div className="flex items-center justify-between gap-2 md:gap-4">
                  <p className="font-heading text-xl leading-tight text-taupe md:text-3xl">{t.title}</p>
                  <span className="shrink-0 text-sm text-taupe">
                    <span className="hidden md:inline">{t.cta} </span>
                    <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-ink/70 md:text-sm">{t.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent shipments */}
        <div className="card !rounded-3xl !p-5 md:!rounded-[2rem] md:!p-8">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow">Latest activity</p>
              <h2 className="mt-1 text-3xl md:text-5xl">Recent Shipments</h2>
            </div>
            <Link href="/orders" className="btn-secondary shrink-0 !px-4 !py-2 md:!px-5">View all</Link>
          </div>
          <div className="mt-5 flex flex-col gap-2.5 md:mt-6 md:gap-3.5">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-2xl border border-taupe/10 bg-cream/70 px-4 py-3 md:rounded-3xl md:px-5 md:py-4 dark:bg-transparent">
                <div className="flex min-w-0 items-center gap-3 md:gap-3.5">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-taupe/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-taupe" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{r.to_name}</p>
                    <p className="truncate text-sm text-ink/60">{r.carrier} {r.mail_class}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-ink/50">{shortWhen(r.created_at)}</span>
              </div>
            ))}
            {loaded && !recent.length && (
              <p className="rounded-2xl border border-taupe/10 bg-cream/70 px-5 py-8 text-center text-sm text-ink/50 md:rounded-3xl">
                Shipments will show up here once you buy your first label.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Shipping map */}
      <div className="card mt-4 overflow-hidden !rounded-3xl !p-5 md:mt-5 md:!rounded-[2rem] md:!p-8">
        <p className="eyebrow">Where they went</p>
        <h2 className="mt-1 text-3xl md:text-5xl">Shipping Map</h2>
        <div className="mt-5 md:mt-6">
          <ShippingMap compact />
        </div>
      </div>
    </Shell>
  );
}
