"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import BarcodeScanner from "@/components/BarcodeScanner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/fetchAll";

// Only the columns this list shows, so loading every order stays quick.
const LIST_COLUMNS =
  "id, order_number, to_name, to_city, to_state, tracking_number, carrier, mail_class, postage_amount, status, print_status, created_at";

// How many rows to draw at once; "Show more" draws the next batch.
const PAGE = 250;

function StatusPill({ status }: { status: string }) {
  if (status === "draft") {
    return (
      <span className="rounded-full border border-dashed border-taupe/50 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-taupe">
        draft
      </span>
    );
  }
  if (status === "refunded") {
    return (
      <span className="rounded-full border border-red-400/50 bg-red-50 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-red-700">
        refunded
      </span>
    );
  }
  return (
    <span className="rounded-full border border-taupe/45 bg-cream px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-ink/80">
      purchased
    </span>
  );
}

function initials(name: string | null) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(function (w) {
      return w[0];
    })
    .join("")
    .toUpperCase();
}

function dateKey(dt: string) {
  return new Date(dt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function shortTracking(tn: string | null) {
  if (!tn) return "-";
  const s = String(tn);
  return "..." + s.slice(-7);
}

function ebNumber(o: any) {
  return o.order_number != null ? "EB-" + o.order_number : "\u2014";
}

export default function OrdersPage() {
  const supabase = useMemo(function () {
    return supabaseBrowser();
  }, []);
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);

  // Scanned a label: find its order and open it.
  const onScan = useCallback(
    async function (code: string): Promise<string | null> {
      try {
        const res = await fetch("/api/scan/lookup?code=" + encodeURIComponent(code), { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.order?.id) return data.error || "No order matches that label.";
        setScanning(false);
        router.push("/orders/" + data.order.id);
        return null;
      } catch {
        return "Couldn't look that up. Check your connection and try again.";
      }
    },
    [router]
  );

  // Loads every order (1,000 at a time), newest first.
  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await fetchAll(function (from, to) {
        return supabase
          .from("shipping_orders")
          .select(LIST_COLUMNS)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to);
      });
      setOrders(rows);
    } catch (e: any) {
      setLoadError(e.message || "Couldn't load orders.");
    }
    setLoading(false);
  }

  useEffect(function () {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(
    function () {
      const c = { all: orders.length, to_print: 0, draft: 0, refunded: 0 };
      for (const o of orders) {
        if (o.status === "draft") c.draft++;
        if (o.status === "refunded") c.refunded++;
        if (o.status === "purchased" && o.print_status === "not_printed") c.to_print++;
      }
      return c;
    },
    [orders]
  );

  // Start from the top again whenever the tab or search changes.
  useEffect(
    function () {
      setVisible(PAGE);
    },
    [filter, q]
  );

  const matching = orders.filter(function (o) {
    if (filter === "draft" && o.status !== "draft") return false;
    if (filter === "refunded" && o.status !== "refunded") return false;
    if (filter === "to_print" && !(o.status === "purchased" && o.print_status === "not_printed")) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    const name = (o.to_name || "").toLowerCase();
    const tn = (o.tracking_number || "").toLowerCase();
    const city = (o.to_city || "").toLowerCase();
    const eb = o.order_number != null ? ("eb-" + o.order_number) : "";
    return name.includes(s) || tn.includes(s) || city.includes(s) || eb.includes(s);
  });

  const shown = matching.slice(0, visible);

  const groups = useMemo(
    function () {
      const todayKey = dateKey(new Date().toISOString());
      const g: { label: string; items: any[] }[] = [];
      for (const o of shown) {
        const k = dateKey(o.created_at);
        const label = k === todayKey ? "Today \u00b7 " + k : k;
        const last = g[g.length - 1];
        if (last && last.label === label) {
          last.items.push(o);
        } else {
          g.push({ label: label, items: [o] });
        }
      }
      return g;
    },
    [shown]
  );

  const TABS = [
    { key: "all", label: "All", count: counts.all },
    { key: "to_print", label: "To print", count: counts.to_print },
    { key: "draft", label: "Drafts", count: counts.draft },
    { key: "refunded", label: "Refunded", count: counts.refunded },
  ];

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Shipment archive</p>
          <h1 className="mt-1 text-5xl">Orders</h1>
        </div>
        <div className="flex flex-wrap gap-1.5 rounded-full border border-taupe/30 bg-white p-1">
          {TABS.map(function (t) {
            return (
              <button
                key={t.key}
                onClick={function () {
                  setFilter(t.key);
                }}
                className={
                  "rounded-full px-4 py-2 text-xs transition-colors " +
                  (filter === t.key ? "bg-taupe text-cream" : "text-taupe hover:bg-taupe/10")
                }
              >
                {t.label} &middot; {t.count}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mt-5">
        <input
          className="input !rounded-full !pr-14"
          placeholder="Search name, EB number, tracking, city..."
          value={q}
          onChange={function (e) {
            setQ(e.target.value);
          }}
        />
        <button
          type="button"
          onClick={function () {
            setScanning(true);
          }}
          aria-label="Scan a label"
          title="Scan a label"
          className="absolute right-1.5 top-1/2 flex h-8 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-taupe text-cream transition-opacity hover:opacity-90 dark:text-[#26211b]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" />
            <path d="M8 9v6M11 9v6M14 9v6M16.5 9v6" />
          </svg>
        </button>
      </div>

      {scanning && (
        <BarcodeScanner
          title="Scan to open order"
          onCode={onScan}
          onClose={function () {
            setScanning(false);
          }}
        />
      )}

      {groups.map(function (g) {
        return (
          <div key={g.label}>
            <p className="eyebrow mt-7 mb-2">{g.label}</p>
            <div className="overflow-hidden rounded-3xl border border-taupe/25 bg-white">
              {g.items.map(function (o, i) {
                return (
                  <button
                    key={o.id}
                    onClick={function () {
                      router.push("/orders/" + o.id);
                    }}
                    className={
                      "flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-cream/50 " +
                      (i !== g.items.length - 1 ? "border-b border-taupe/15" : "")
                    }
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-xs text-taupe">
                      {initials(o.to_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{o.to_name || "Untitled order"}</span>
                      <span className="block truncate text-xs text-ink/60">
                        {ebNumber(o)}
                        {" \u00b7 "}
                        {o.carrier ? o.carrier + " " + o.mail_class : "Draft"}
                        {o.to_city ? " \u00b7 " + o.to_city + ", " + o.to_state : ""}
                      </span>
                    </span>
                    <span className="hidden font-mono text-xs text-ink/60 sm:block">{shortTracking(o.tracking_number)}</span>
                    <span className="hidden text-xs text-taupe md:block">
                      {o.postage_amount != null ? "$" + Number(o.postage_amount).toFixed(2) : "-"}
                    </span>
                    <StatusPill status={o.status} />
                    <span className="text-taupe">&rsaquo;</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {matching.length > visible && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            onClick={function () {
              setVisible(function (v) {
                return v + PAGE;
              });
            }}
            className="btn-secondary !px-6"
          >
            Show more
          </button>
          <p className="text-xs text-ink/50">
            Showing {visible.toLocaleString()} of {matching.length.toLocaleString()}
          </p>
        </div>
      )}

      {loading && (
        <p className="mt-7 rounded-3xl border border-taupe/25 bg-white px-6 py-12 text-center text-sm text-ink/50">
          Loading all orders…
        </p>
      )}
      {loadError && (
        <p className="mt-7 rounded-3xl bg-red-50 px-6 py-4 text-center text-sm text-red-700">
          {loadError}{" "}
          <button onClick={load} className="underline underline-offset-2">Try again</button>
        </p>
      )}
      {!loading && !loadError && !groups.length && (
        <p className="mt-7 rounded-3xl border border-taupe/25 bg-white px-6 py-12 text-center text-sm text-ink/50">
          {orders.length ? "No orders match." : "No orders yet. Create a label to get started."}
        </p>
      )}
      {!loading && orders.length > 0 && matching.length <= visible && (
        <p className="mt-6 text-center text-xs text-ink/40">
          {matching.length === orders.length
            ? "All " + orders.length.toLocaleString() + " orders shown"
            : matching.length.toLocaleString() + " of " + orders.length.toLocaleString() + " orders shown"}
        </p>
      )}
    </Shell>
  );
}
