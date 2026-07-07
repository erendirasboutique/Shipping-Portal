"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";

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
        supabase.from("shipping_orders").select("to_name, carrier, mail_class, tracking_number, created_at")
          .not("tracking_number", "is", null).order("created_at", { ascending: false }).limit(6),
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

  const manifest = [
    { label: "Today's shipments", value: stats.today },
    { label: "Customers", value: stats.customers },
    { label: "Labels purchased", value: stats.purchased },
    { label: "Pending drafts", value: stats.drafts },
    { label: "Print queue", value: stats.queue },
    { label: "Postage spent", value: `$${stats.postage.toFixed(2)}` },
  ];

  const actions = [
    { href: "/create-label", no: "01", title: "Create a Label", desc: "Search customer, choose rate, buy 4×6 PDF" },
    { href: "/batch-print", no: "02", title: "Batch Print", desc: "Combine purchased labels into one PDF", badge: stats.queue },
    { href: "/orders", no: "03", title: "Orders", desc: "Review shipments, tracking, refunds", badge: stats.drafts },
    { href: "/customers", no: "04", title: "Customers", desc: "Import CSV, edit addresses, merge duplicates" },
    { href: "/returns", no: "05", title: "Returns", desc: "Access codes, requests, USPS return labels" },
  ];

  return (
    <Shell>
      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Shipping Studio</p>
          <h1 className="mt-2 text-5xl sm:text-6xl">Shipping Portal</h1>
          <p className="mt-3 max-w-md text-sm text-ink/70">
            Create 4×6 labels, manage customers, review shipments, and print batches.
          </p>
        </div>
        <div className="stamp">
          <p className="eyebrow">Today</p>
          <p className="font-heading text-5xl text-taupe">{stats.today}</p>
          <p className="text-xs text-ink/60">shipments created</p>
        </div>
      </div>

      {/* Manifest strip */}
      <div className="card mt-8 grid grid-cols-2 gap-y-5 !p-5 sm:grid-cols-3 xl:grid-cols-6">
        {manifest.map((m, i) => (
          <div key={m.label} className={`px-4 ${i !== 0 ? "sm:border-l sm:border-taupe/20" : ""}`}>
            <p className="eyebrow">{m.label}</p>
            <p className="mt-1 font-heading text-3xl text-taupe">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        {/* Quick actions */}
        <section>
          <p className="eyebrow">Start here</p>
          <h2 className="mt-1 text-3xl">Quick Actions</h2>
          <div className="mt-5">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-baseline gap-4 border-b border-dashed border-taupe/35 py-4 first:border-t"
              >
                <span className="font-mono text-xs text-taupe/60">{a.no}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-xl text-taupe group-hover:underline">
                    {a.title}
                    {!!a.badge && (
                      <span className="pill ml-3 border-taupe/50 align-middle text-taupe">{a.badge}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-ink/70">{a.desc}</span>
                </span>
                <span className="text-taupe transition-transform group-hover:translate-x-1">→</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent shipments */}
        <section>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Latest activity</p>
              <h2 className="mt-1 text-3xl">Recent Shipments</h2>
            </div>
            <Link href="/orders" className="btn-secondary !px-4 !py-1.5">View all</Link>
          </div>
          <div className="mt-5">
            {recent.map((r, i) => (
              <div key={i} className="border-b border-dashed border-taupe/35 py-3.5 first:border-t">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">{r.to_name}</p>
                  <span className="pill border-taupe/50 text-taupe">purchased</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-xs text-ink/60">
                  <span>{r.carrier} {r.mail_class}</span>
                  <span className="font-mono">{r.tracking_number}</span>
                </div>
              </div>
            ))}
            {!recent.length && (
              <p className="border-y border-dashed border-taupe/35 py-8 text-center text-sm text-ink/50">
                Shipments will appear here once you buy your first label.
              </p>
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}
