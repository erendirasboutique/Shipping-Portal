"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import BarcodeScanner from "@/components/BarcodeScanner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/fetchAll";

// Only the columns this list shows, so loading every order stays quick.
// The tracking_* columns are filled in by the Shippo/EasyPost webhooks
// (supabase/tracking-webhooks.sql).
const LIST_COLUMNS =
  "id, order_number, to_name, to_city, to_state, tracking_number, tracking_url, label_url, carrier, mail_class, postage_amount, status, print_status, created_at, " +
  "tracking_status, tracking_last_event, tracking_last_location, tracking_last_event_at, tracking_eta, delivered_at";

// Extra detail loaded only when an order is opened in the desktop pop-up.
const DETAIL_COLUMNS =
  "id, to_street1, to_street2, to_city, to_state, to_zip, tracking_events, first_scan_at, printed_at, refund_status";

// How many rows to draw at once; "Show more" draws the next batch.
const PAGE = 250;

// ---------- Where each order stands ----------
// One answer per order, from the portal's own status plus carrier tracking.
type Stage =
  | "draft"
  | "to_print"
  | "awaiting_scan"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "problem"
  | "refunded";

const PROBLEM_STATUSES = ["return_to_sender", "failure", "error", "cancelled", "available_for_pickup"];

function stageOf(o: any): Stage {
  if (o.status === "draft") return "draft";
  if (o.status === "refunded") return "refunded";
  const t = String(o.tracking_status || "").toLowerCase();
  if (o.delivered_at || t === "delivered") return "delivered";
  if (PROBLEM_STATUSES.includes(t)) return "problem";
  if (t === "out_for_delivery") return "out_for_delivery";
  if (t === "in_transit") return "in_transit";
  if (o.print_status === "not_printed") return "to_print";
  return "awaiting_scan";
}

function needsAction(s: Stage) {
  return s === "draft" || s === "to_print" || s === "problem";
}

const STAGE_LABEL: Record<Stage, string> = {
  draft: "Draft",
  to_print: "To print",
  awaiting_scan: "Label created",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  problem: "Needs a look",
  refunded: "Refunded",
};

const STAGE_STYLE: Record<Stage, string> = {
  draft: "border-amber-400/60 bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200",
  to_print: "border-amber-400/60 bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200",
  awaiting_scan: "border-taupe/45 bg-cream text-ink/80",
  in_transit: "border-sky-400/50 bg-sky-50 text-sky-900 dark:bg-sky-400/10 dark:text-sky-200",
  out_for_delivery: "border-sky-500/60 bg-sky-100 text-sky-950 dark:bg-sky-400/20 dark:text-sky-100",
  delivered: "border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-200",
  problem: "border-red-400/50 bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-200",
  refunded: "border-red-300/50 bg-white text-red-700 dark:text-red-300",
};

function StagePill({ stage }: { stage: Stage }) {
  return (
    <span
      className={
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em] " +
        STAGE_STYLE[stage]
      }
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}

// The one line under "Latest update": what happened last, or why it needs you.
function latestUpdate(o: any, stage: Stage): string {
  if (stage === "draft") return "Needs a label";
  if (stage === "refunded") return "Label refunded";
  if (stage === "to_print") return "Label bought, not printed yet";
  if (o.tracking_last_event) {
    return [o.tracking_last_event, o.tracking_last_location, shortWhen(o.tracking_last_event_at)].filter(Boolean).join(" · ");
  }
  if (stage === "delivered") return "Delivered" + (o.delivered_at ? " · " + shortWhen(o.delivered_at) : "");
  // Labels from before the tracking webhooks were set up never get updates.
  if (Date.now() - new Date(o.created_at).getTime() > 14 * 86400000) return "No tracking updates saved";
  return "Awaiting first carrier scan";
}

// ---------- Small formatters ----------
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

function shortWhen(dt: string | null) {
  if (!dt) return "";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function shortDate(dt: string | null) {
  if (!dt) return "";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function shortTracking(tn: string | null) {
  if (!tn) return "-";
  const s = String(tn);
  return "..." + s.slice(-7);
}

function ebNumber(o: any) {
  return o.order_number != null ? "EB-" + o.order_number : "—";
}

function money(n: any) {
  return n != null ? "$" + Number(n).toFixed(2) : "-";
}

function serviceText(o: any) {
  return o.carrier ? o.carrier + (o.mail_class ? " " + o.mail_class : "") : "No label yet";
}

// Carrier's own tracking page: the saved link if we have one, otherwise built from the number.
function trackingLink(o: any): string | null {
  if (o.tracking_url) return o.tracking_url;
  if (!o.tracking_number) return null;
  const tn = encodeURIComponent(o.tracking_number);
  const c = String(o.carrier || "").toLowerCase();
  if (c.includes("ups")) return "https://www.ups.com/track?tracknum=" + tn;
  if (c.includes("fedex")) return "https://www.fedex.com/fedextrack/?trknbr=" + tn;
  return "https://tools.usps.com/go/TrackConfirmAction?tLabels=" + tn;
}

// Pop-up on bigger screens (iPad, iPhone Duo open, computers); on phones,
// including phones turned sideways, an order always opens its full page.
function isDesktop() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 600px) and (min-height: 560px)").matches;
}

const DATE_RANGES = [
  { key: "all", label: "All dates", days: 0 },
  { key: "today", label: "Today", days: 1 },
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
];

export default function OrdersPage() {
  const supabase = useMemo(function () {
    return supabaseBrowser();
  }, []);
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [range, setRange] = useState("all");
  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

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
      setOrders(
        rows.map(function (o: any) {
          return { ...o, _stage: stageOf(o) };
        })
      );
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
      const c: Record<string, number> = {
        all: orders.length,
        action: 0,
        draft: 0,
        to_print: 0,
        problem: 0,
        awaiting: 0,
        moving: 0,
        delivered: 0,
        refunded: 0,
      };
      for (const o of orders) {
        const s: Stage = o._stage;
        if (needsAction(s)) c.action++;
        if (s === "draft") c.draft++;
        if (s === "to_print") c.to_print++;
        if (s === "problem") c.problem++;
        if (s === "awaiting_scan") c.awaiting++;
        if (s === "in_transit" || s === "out_for_delivery") c.moving++;
        if (s === "delivered") c.delivered++;
        if (s === "refunded") c.refunded++;
      }
      return c;
    },
    [orders]
  );

  // Start from the top again whenever the tab, date or search changes.
  useEffect(
    function () {
      setVisible(PAGE);
    },
    [filter, range, q]
  );

  const since = useMemo(
    function () {
      const r = DATE_RANGES.find(function (x) {
        return x.key === range;
      });
      if (!r || !r.days) return 0;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (r.days - 1));
      return start.getTime();
    },
    [range]
  );

  const matching = orders.filter(function (o) {
    const s: Stage = o._stage;
    if (filter === "action" && !needsAction(s)) return false;
    if (filter === "draft" && s !== "draft") return false;
    if (filter === "to_print" && s !== "to_print") return false;
    if (filter === "awaiting" && s !== "awaiting_scan") return false;
    if (filter === "moving" && s !== "in_transit" && s !== "out_for_delivery") return false;
    if (filter === "delivered" && s !== "delivered") return false;
    if (filter === "refunded" && s !== "refunded") return false;
    if (since && new Date(o.created_at).getTime() < since) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase().trim();
    const name = (o.to_name || "").toLowerCase();
    const tn = (o.tracking_number || "").toLowerCase();
    const city = (o.to_city || "").toLowerCase();
    const eb = o.order_number != null ? "eb-" + o.order_number : "";
    const num = o.order_number != null ? String(o.order_number) : "";
    return name.includes(t) || tn.includes(t) || city.includes(t) || eb.includes(t) || num === t;
  });

  const shown = matching.slice(0, visible);

  const groups = useMemo(
    function () {
      const todayKey = dateKey(new Date().toISOString());
      const g: { label: string; items: any[] }[] = [];
      for (const o of shown) {
        const k = dateKey(o.created_at);
        const label = k === todayKey ? "Today · " + k : k;
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
    { key: "action", label: "Needs action", count: counts.action },
    { key: "to_print", label: "To print", count: counts.to_print },
    { key: "draft", label: "Drafts", count: counts.draft },
    { key: "awaiting", label: "Awaiting scan", count: counts.awaiting },
    { key: "moving", label: "In transit", count: counts.moving },
    { key: "delivered", label: "Delivered", count: counts.delivered },
    { key: "refunded", label: "Refunded", count: counts.refunded },
  ];

  // What the attention banner lists.
  const attention: string[] = [];
  if (counts.draft) attention.push(counts.draft + (counts.draft === 1 ? " draft needs" : " drafts need") + " a label");
  if (counts.to_print) attention.push(counts.to_print + (counts.to_print === 1 ? " label" : " labels") + " to print");
  if (counts.problem) attention.push(counts.problem + (counts.problem === 1 ? " delivery problem" : " delivery problems"));

  const openOrder = orders.find(function (o) {
    return o.id === openId;
  });

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Shipment archive</p>
          <h1 className="mt-1 text-5xl">Orders</h1>
        </div>
      </div>

      {!loading && attention.length > 0 && filter !== "action" && (
        <div
          role="status"
          className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-400/10 dark:text-amber-100"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4l9 16H3z" />
            <path d="M12 10v4M12 17h.01" />
          </svg>
          <span className="min-w-0 flex-1">{attention.join(" · ")}</span>
          <button
            onClick={function () {
              setFilter("action");
            }}
            className="min-h-[44px] font-medium underline underline-offset-2"
          >
            Show them
          </button>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3">
        <div className="relative">
          <label htmlFor="order-search" className="sr-only">
            Search orders
          </label>
          <input
            id="order-search"
            type="search"
            className="input !rounded-full !py-3 !pr-14"
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
            className="absolute right-1.5 top-1/2 flex h-9 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-taupe text-cream transition-opacity hover:opacity-90 dark:text-[#26211b]"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" />
              <path d="M8 9v6M11 9v6M14 9v6M16.5 9v6" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Filter by status"
            className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
          >
            {TABS.map(function (t) {
              const on = filter === t.key;
              return (
                <button
                  key={t.key}
                  aria-pressed={on}
                  onClick={function () {
                    setFilter(t.key);
                  }}
                  className={
                    "min-h-[40px] shrink-0 whitespace-nowrap rounded-full border px-4 text-xs transition-colors " +
                    (on ? "border-taupe bg-taupe text-cream dark:text-[#26211b]" : "border-taupe/30 bg-white text-ink/80 hover:bg-taupe/10")
                  }
                >
                  {t.label} &middot; {t.count.toLocaleString()}
                </button>
              );
            })}
          </div>
          <label className="flex shrink-0 items-center gap-2 rounded-full border border-taupe/30 bg-white pl-4 pr-2 text-xs text-ink/70">
            <span className="sr-only sm:not-sr-only">Date</span>
            <select
              value={range}
              onChange={function (e) {
                setRange(e.target.value);
              }}
              className="min-h-[40px] bg-transparent text-xs text-ink outline-none"
            >
              {DATE_RANGES.map(function (r) {
                return (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
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
          <section key={g.label} aria-label={g.label}>
            <div className="mb-2 mt-7 flex items-baseline justify-between">
              <h2 className="eyebrow">{g.label}</h2>
              <span className="text-xs text-ink/50">
                {g.items.length} {g.items.length === 1 ? "order" : "orders"}
              </span>
            </div>
            <div className="overflow-hidden rounded-3xl border border-taupe/25 bg-white">
              {g.items.map(function (o, i) {
                const stage: Stage = o._stage;
                const update = latestUpdate(o, stage);
                return (
                  <a
                    key={o.id}
                    href={"/orders/" + o.id}
                    onClick={function (e) {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      if (isDesktop()) setOpenId(o.id);
                      else router.push("/orders/" + o.id);
                    }}
                    className={
                      "flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-cream/50 focus-visible:bg-cream/60 focus-visible:outline-none sm:px-5 " +
                      (i !== g.items.length - 1 ? "border-b border-taupe/15" : "")
                    }
                  >
                    <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-xs text-taupe sm:flex">
                      {initials(o.to_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-[15px] font-medium text-ink">{o.to_name || "Untitled order"}</span>
                        <span className="md:hidden">
                          <StagePill stage={stage} />
                        </span>
                      </span>
                      <span className="block truncate text-xs text-ink/60">
                        {ebNumber(o)}
                        {" · "}
                        {serviceText(o)}
                        {o.to_city ? " · " + o.to_city + ", " + o.to_state : ""}
                      </span>
                      <span
                        className={
                          "mt-0.5 block truncate text-xs md:hidden " + (needsAction(stage) ? "text-amber-800 dark:text-amber-200" : "text-ink/60")
                        }
                      >
                        {update}
                      </span>
                    </span>
                    <span
                      className={
                        "hidden w-[30%] min-w-0 shrink-0 truncate text-xs lg:block " +
                        (needsAction(stage) ? "text-amber-800 dark:text-amber-200" : "text-ink/70")
                      }
                    >
                      {update}
                      {o.tracking_eta && stage !== "delivered" && !needsAction(stage) && (
                        <span className="block truncate text-ink/50">Est. {shortDate(o.tracking_eta)}</span>
                      )}
                    </span>
                    <span className="hidden w-[84px] shrink-0 text-right text-xs text-ink/60 md:block">{shortTracking(o.tracking_number)}</span>
                    <span className="hidden w-[56px] shrink-0 text-right text-xs text-taupe md:block">{money(o.postage_amount)}</span>
                    <span className="hidden w-[124px] shrink-0 justify-end md:flex">
                      <StagePill stage={stage} />
                    </span>
                    <span aria-hidden="true" className="text-taupe">
                      &rsaquo;
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
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
        <p className="mt-7 rounded-3xl border border-taupe/25 bg-white px-6 py-12 text-center text-sm text-ink/50">Loading all orders…</p>
      )}
      {loadError && (
        <p className="mt-7 rounded-3xl bg-red-50 px-6 py-4 text-center text-sm text-red-700">
          {loadError}{" "}
          <button onClick={load} className="underline underline-offset-2">
            Try again
          </button>
        </p>
      )}
      {!loading && !loadError && !groups.length && (
        <p className="mt-7 rounded-3xl border border-taupe/25 bg-white px-6 py-12 text-center text-sm text-ink/50">
          {orders.length
            ? filter === "action"
              ? "Nothing needs your attention right now."
              : "No orders match. Try a different name, EB number, tracking number or date."
            : "No orders yet. Create a label to get started."}
        </p>
      )}
      {!loading && orders.length > 0 && matching.length <= visible && (
        <p className="mt-6 text-center text-xs text-ink/40">
          {matching.length === orders.length
            ? "All " + orders.length.toLocaleString() + " orders shown"
            : matching.length.toLocaleString() + " of " + orders.length.toLocaleString() + " orders shown"}
        </p>
      )}

      {openOrder && (
        <OrderModal
          order={openOrder}
          supabase={supabase}
          onClose={function () {
            setOpenId(null);
          }}
        />
      )}
    </Shell>
  );
}

// ---------- Desktop pop-up ----------
function OrderModal({ order, supabase, onClose }: { order: any; supabase: any; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [detailError, setDetailError] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const stage: Stage = order._stage;
  const link = trackingLink(order);

  useEffect(
    function () {
      let alive = true;
      supabase
        .from("shipping_orders")
        .select(DETAIL_COLUMNS)
        .eq("id", order.id)
        .single()
        .then(function (r: any) {
          if (!alive) return;
          if (r.error) setDetailError(true);
          else setDetail(r.data);
        });
      return function () {
        alive = false;
      };
    },
    [order.id, supabase]
  );

  // Escape closes; the page behind doesn't scroll; focus starts on Close and returns afterwards.
  useEffect(
    function () {
      const before = document.activeElement as HTMLElement | null;
      closeRef.current?.focus();
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") onCloseRef.current();
      }
      window.addEventListener("keydown", onKey);
      return function () {
        window.removeEventListener("keydown", onKey);
        document.body.style.overflow = prevOverflow;
        before?.focus?.();
      };
    },
    []
  );

  async function copyTracking() {
    if (!order.tracking_number) return;
    try {
      await navigator.clipboard.writeText(order.tracking_number);
      setCopied(true);
      setTimeout(function () {
        setCopied(false);
      }, 2000);
    } catch {
      window.prompt("Copy the tracking number:", order.tracking_number);
    }
  }

  // Carrier scans, newest first; portal events fill in around them.
  const events: { title: string; sub: string; done: boolean }[] = [];
  const scans: any[] = Array.isArray(detail?.tracking_events) ? detail.tracking_events : [];
  for (const e of scans) {
    events.push({ title: e.message || e.status || "Carrier update", sub: [e.location, shortWhen(e.at)].filter(Boolean).join(" · "), done: true });
  }
  if (stage === "refunded") {
    events.unshift({ title: "Label refunded", sub: detail?.refund_status || "", done: true });
  } else if (!scans.length && order.tracking_number && stage !== "draft") {
    events.push({
      title: order.tracking_last_event || (stage === "delivered" ? "Delivered" : "Awaiting first carrier scan"),
      sub: [order.tracking_last_location, shortWhen(order.tracking_last_event_at || order.delivered_at)].filter(Boolean).join(" · ") ||
        "Scans appear here as " + (order.carrier || "the carrier") + " reports them",
      done: !!order.tracking_last_event || stage === "delivered",
    });
  }
  if (detail?.printed_at) events.push({ title: "Label printed", sub: shortWhen(detail.printed_at), done: true });
  if (stage !== "draft") events.push({ title: "Label purchased", sub: shortWhen(order.created_at) + " · " + serviceText(order), done: true });
  else events.push({ title: "Draft created", sub: shortWhen(order.created_at), done: true });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-10 backdrop-blur-[2px]"
      onMouseDown={function (e) {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-modal-title"
        className="relative w-full max-w-[600px] rounded-3xl border border-taupe/20 bg-white p-7 shadow-soft"
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-ink/70 hover:bg-taupe/10"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="flex items-center gap-3 pr-12">
          <p className="eyebrow">Order {ebNumber(order)}</p>
          <StagePill stage={stage} />
        </div>
        <h2 id="order-modal-title" className="mt-2 text-3xl leading-tight">
          {order.to_name || "Untitled order"}
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          {[order.to_city ? order.to_city + ", " + order.to_state : null, serviceText(order)].filter(Boolean).join(" · ")}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {order.tracking_number && (
            <button onClick={copyTracking} className="btn-primary min-h-[44px]">
              {copied ? "Copied" : "Copy tracking"}
            </button>
          )}
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="btn-secondary min-h-[44px]">
              Track on {order.carrier || "carrier"}
            </a>
          )}
          {order.label_url && stage !== "refunded" && (
            <a href={order.label_url} target="_blank" rel="noopener noreferrer" className="btn-secondary min-h-[44px]">
              Open label
            </a>
          )}
          <a href={"/orders/" + order.id} className="btn-secondary min-h-[44px]">
            Open full order
          </a>
        </div>

        <section className="mt-6 border-t border-taupe/15 pt-5">
          <h3 className="label">Shipment</h3>
          <dl className="mt-2 grid grid-cols-[130px_minmax(0,1fr)] gap-y-2 text-sm">
            <dt className="text-ink/60">Service</dt>
            <dd>{serviceText(order)}</dd>
            <dt className="text-ink/60">Tracking</dt>
            <dd className="break-all">{order.tracking_number || "None yet"}</dd>
            <dt className="text-ink/60">Label cost</dt>
            <dd>{money(order.postage_amount)}</dd>
            <dt className="text-ink/60">Est. delivery</dt>
            <dd className={order.tracking_eta ? "" : "text-ink/50"}>
              {stage === "delivered"
                ? "Delivered " + shortDate(order.delivered_at || order.tracking_last_event_at)
                : order.tracking_eta
                ? shortDate(order.tracking_eta)
                : "Not provided by the carrier"}
            </dd>
          </dl>
        </section>

        <section className="mt-5 border-t border-taupe/15 pt-5">
          <h3 className="label">Ship to</h3>
          {detail ? (
            <address className="mt-2 text-sm not-italic leading-relaxed">
              {order.to_name}
              <br />
              {detail.to_street1}
              {detail.to_street2 ? (
                <>
                  <br />
                  {detail.to_street2}
                </>
              ) : null}
              <br />
              {[detail.to_city, detail.to_state].filter(Boolean).join(", ")} {detail.to_zip}
            </address>
          ) : (
            <p className="mt-2 text-sm text-ink/50">{detailError ? "Couldn't load the address. Open the full order." : "Loading…"}</p>
          )}
        </section>

        <section className="mt-5 border-t border-taupe/15 pt-5">
          <h3 className="label">Timeline</h3>
          <ol className="mt-3 flex flex-col gap-4">
            {events.map(function (e, i) {
              return (
                <li key={i} className="grid grid-cols-[18px_minmax(0,1fr)] gap-3">
                  <span
                    aria-hidden="true"
                    className={
                      "mt-1 h-3 w-3 rounded-full border-2 " + (e.done ? (i === 0 ? "border-taupe bg-taupe" : "border-sand bg-sand") : "border-sand bg-white")
                    }
                  />
                  <span>
                    <span className={"block text-sm " + (e.done ? "text-ink" : "text-ink/60")}>{e.title}</span>
                    {e.sub && <span className="block text-xs text-ink/55">{e.sub}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
