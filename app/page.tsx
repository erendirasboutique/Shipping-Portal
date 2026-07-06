"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Dashboard() {
  const [stats, setStats] = useState({ drafts: 0, unprinted: 0, returns: 0, customers: 0 });

  useEffect(() => {
    const supabase = supabaseBrowser();
    (async () => {
      const [drafts, unprinted, returns, customers] = await Promise.all([
        supabase.from("shipping_orders").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("shipping_orders").select("id", { count: "exact", head: true }).eq("status", "purchased").eq("print_status", "not_printed"),
        supabase.from("return_requests").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("shipping_customers").select("id", { count: "exact", head: true }).eq("archived", false),
      ]);
      setStats({
        drafts: drafts.count ?? 0,
        unprinted: unprinted.count ?? 0,
        returns: returns.count ?? 0,
        customers: customers.count ?? 0,
      });
    })();
  }, []);

  const actions = [
    { href: "/create-label", title: "Create Label", desc: "New shipment with live USPS, UPS & FedEx rates" },
    { href: "/batch-print", title: "Batch Print", desc: `${stats.unprinted} purchased label${stats.unprinted === 1 ? "" : "s"} waiting to print`, badge: stats.unprinted },
    { href: "/orders", title: "Orders", desc: `${stats.drafts} draft${stats.drafts === 1 ? "" : "s"} to finish` , badge: stats.drafts },
    { href: "/returns", title: "Returns", desc: `${stats.returns} return request${stats.returns === 1 ? "" : "s"} submitted`, badge: stats.returns },
    { href: "/customers", title: "Customers", desc: `${stats.customers} saved customers` },
  ];

  return (
    <Shell>
      <h1 className="text-4xl">Good to see you.</h1>
      <p className="mt-2 text-taupe/80">What are we shipping today?</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className="card group relative transition-shadow hover:shadow-lg">
            {!!a.badge && (
              <span className="absolute right-5 top-5 rounded-full bg-taupe px-2.5 py-0.5 text-xs font-semibold text-cream">
                {a.badge}
              </span>
            )}
            <h2 className="text-xl group-hover:underline">{a.title}</h2>
            <p className="mt-1.5 text-sm text-ink/70">{a.desc}</p>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
