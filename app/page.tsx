"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";

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
        supabase.from("shipping_orders").select("to_name, carrier, mail_class, status, created_at")
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

  const actions = [
    { href: "/create-label", title: "Create a Label", desc: "Search customer, choose rate, buy 4×6 PDF", cta: "Start", solid: true },
    { href: "/batch-print", title: "Batch Print", desc: "Combine selected purchased labels into one PDF", cta: "Open" },
    { href: "/customers", title: "Customers", desc: "Import CSV, edit addresses, merge duplicates", cta: "Manage" },
    { href: "/orders", title: "Orders", desc: "Review shipments, tracking, refunds, labels", cta: "View" },
  ];

  return (
    <Shell>
      {/* Hero */}
      <div className="card relative overflow-hidden border-l-4 !border-l-taupe">
        <Flower className="absolute -right-2 -top-2 w-16 text-sand/40" />
        <Flower className="absolute right-12 top-8 w-10 text-sand/30" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-taupe/70">Shipping Studio</p>
            <h1 className="mt-1 text-5xl">Shipping Portal</h1>
            <p className="mt-3 text-sm text-ink/70">
              Create 4×6 labels, manage customers, review shipments, and print batches.
            </p>
          </div>
          <div className="relative rounded-2xl border border-sand/60 bg-cream px-8 py-4 text-center dark:bg-transparent">
            <p className="text-sm text-ink/70">Today</p>
            <p className="font-heading text-5xl text-taupe">{stats.today}</p>
            <p className="text-xs text-ink/60">shipments created</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {statCards.map((s) => (
          <div key={s.label} className="card !p-4">
            <p className="text-xs text-ink/70">{s.label}</p>
            <p className="mt-1 font-heading text-3xl text-taupe">{s.value}</p>
            <p className="mt-1 text-xs text-ink/50">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        {/* Quick actions */}
        <div className="card">
          <p className="text-[10px] uppercase tracking-[0.25em] text-taupe/70">Start here</p>
          <h2 className="mt-1 text-4xl">Quick Actions</h2>
          <div className="mt-5 flex flex-col gap-4">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className={`group flex items-center justify-between gap-4 rounded-2xl p-6 transition-colors ${
                  a.solid
                    ? "bg-taupe text-cream"
                    : "border border-sand/60 bg-white hover:bg-sand/15 dark:bg-transparent"
                }`}
              >
                <div>
                  <p className={`font-heading text-2xl ${a.solid ? "text-cream" : "text-taupe"}`}>{a.title}</p>
                  <p className={`mt-1 text-sm ${a.solid ? "text-cream/90" : "text-ink/70"}`}>{a.desc}</p>
                </div>
                <span className={`shrink-0 text-sm ${a.solid ? "text-cream" : "text-taupe"}`}>
                  {a.cta} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent shipments */}
        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-taupe/70">Latest activity</p>
              <h2 className="mt-1 text-4xl">Recent Shipments</h2>
            </div>
            <Link href="/orders" className="btn-secondary !px-4 !py-2 !text-xs">View all</Link>
          </div>
          <div className="mt-5 flex flex-col gap-3">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-sand/15 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-taupe" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.to_name}</p>
                    <p className="truncate text-xs text-ink/60">{r.carrier} {r.mail_class}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-ink/50">label_purchased</span>
              </div>
            ))}
            {!recent.length && (
              <p className="rounded-2xl bg-sand/15 px-4 py-6 text-center text-sm text-ink/50">
                Shipments will show up here once you buy your first label.
              </p>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
