"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";
import ShippingMap from "@/components/ShippingMap";

const Flower = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden>
    {[0, 90, 180, 270].map((r) => (
      <ellipse key={r} cx="20" cy="11" rx="6" ry="9" fill="currentColor" transform={`rotate(${r} 20 20)`} />
    ))}
    <circle cx="20" cy="20" r="4" fill="currentColor" />
  </svg>
);

export default function Dashboard() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [stats, setStats] = useState({ today: 0, customers: 0, purchased: 0, drafts: 0, queue: 0, postage: 0 });
  const [recent, setRecent] = useState<any[]>([]);

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
        supabase.from("shipping_orders").select("postage_amount").not("postage_amount", "is", null),
        supabase.from("shipping_orders").select("to_name, carrier, mail_class, created_at")
          .not("tracking_number", "is", null).order("created_at", { ascending: false }).limit(7),
      ]);
      setStats({
        today: today.count ?? 0,
        customers: customers.count ?? 0,
        purchased: purchased.count ?? 0,
        drafts: drafts.count ?? 0,
        queue: queue.count ?? 0,
        postage: (postageRows.data ?? []).reduce((s, r) => s + Number(r.postage_amount || 0), 0),
      });
      setRecent(recentRows.data ?? []);
    })();
  }, [supabase]);

  const statCards = [
    { label: "Today's Shipments", value: stats.today, sub: "Created today" },
    { label: "Customers", value: stats.customers, sub: "Saved profiles" },
    { label: "Labels Purchased", value: stats.purchased, sub: "All-time purchased" },
    { label: "Pending Labels", value: stats.drafts, sub: "Drafts/rates ready" },
    { label: "Print Queue", value: stats.queue, sub: "Ready to print" },
    { label: "Postage Spent", value: `$${stats.postage.toFixed(2)}`, sub: "Purchased postage" },
  ];

  const tiles = [
    { href: "/scan", title: "Scan & Send", desc: "Scan packed labels, snap a photo, message the customer", cta: "Open" },
    { href: "/batch-print", title: "Batch Print", desc: "Combine selected purchased labels into one PDF", cta: "Open" },
    { href: "/customers", title: "Customers", desc: "Import CSV, edit addresses, merge duplicates", cta: "Manage" },
    { href: "/orders", title: "Orders", desc: "Review shipments, tracking, refunds, labels", cta: "View" },
  ];

  return (
    <Shell>
      {/* Hero */}
      <div className="card relative overflow-hidden !rounded-[2rem] border-l-[6px] !border-l-taupe/70 !p-8">
        <Flower className="absolute -right-3 -top-3 w-20 text-sand/35" />
        <Flower className="absolute right-16 top-10 w-10 text-sand/25" />
        <Flower className="absolute -bottom-4 right-6 w-14 text-sand/20" />
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="eyebrow">Shipping Studio</p>
            <h1 className="mt-1 text-6xl">Shipping Portal</h1>
            <p className="mt-3 text-sm text-ink/70">
              Create 4×6 labels, manage customers, review shipments, and print batches.
            </p>
          </div>
          <div className="stamp relative">
            <Flower className="absolute -right-4 -top-4 w-10 text-sand/40" />
            <p className="text-sm text-ink/70">Today</p>
            <p className="font-heading text-6xl text-taupe">{stats.today}</p>
            <p className="text-xs text-ink/60">shipments created</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {statCards.map((s) => (
          <div key={s.label} className="card !rounded-3xl !p-5">
            <p className="text-xs text-ink/70">{s.label}</p>
            <p className="mt-2 font-heading text-4xl text-taupe">{s.value}</p>
            <p className="mt-2 text-xs text-ink/50">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {/* Quick actions */}
        <div className="card !rounded-[2rem] !p-8">
          <p className="eyebrow">Start here</p>
          <h2 className="mt-1 text-5xl">Quick Actions</h2>

          <Link
            href="/create-label"
            className="group mt-6 block rounded-[1.75rem] bg-taupe p-7 text-cream transition-colors hover:bg-[#87715a]"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="font-heading text-4xl text-cream">Create a Label</p>
              <span className="shrink-0 text-sm">
                Start <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </span>
            </div>
            <p className="mt-2 text-sm text-cream/90">Search customer, choose rate, buy 4×6 PDF</p>
          </Link>

          <div className="mt-4 flex flex-col gap-4">
            {tiles.map((t) => (
              <Link key={t.href} href={t.href} className="tile group !p-7">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-heading text-3xl text-taupe">{t.title}</p>
                  <span className="shrink-0 text-sm text-taupe">
                    {t.cta} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink/70">{t.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent shipments */}
        <div className="card !rounded-[2rem] !p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Latest activity</p>
              <h2 className="mt-1 text-5xl">Recent Shipments</h2>
            </div>
            <Link href="/orders" className="btn-secondary shrink-0 !px-5 !py-2">View all</Link>
          </div>
          <div className="mt-6 flex flex-col gap-3.5">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-4 rounded-3xl border border-taupe/10 bg-cream/70 px-5 py-4 dark:bg-transparent">
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-taupe/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-taupe" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{r.to_name}</p>
                    <p className="truncate text-sm text-ink/60">{r.carrier} {r.mail_class}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-ink/50">label_purchased</span>
              </div>
            ))}
            {!recent.length && (
              <p className="rounded-3xl border border-taupe/10 bg-cream/70 px-5 py-8 text-center text-sm text-ink/50">
                Shipments will show up here once you buy your first label.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Shipping map */}
      <div className="card mt-5 !rounded-[2rem] !p-8">
        <p className="eyebrow">Where they went</p>
        <h2 className="mt-1 text-5xl">Shipping Map</h2>
        <div className="mt-6">
          <ShippingMap compact />
        </div>
      </div>
    </Shell>
  );
}
