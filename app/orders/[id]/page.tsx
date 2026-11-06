"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Shell from "@/components/Shell";
import { shippingNotice } from "@/lib/shipNotice";
import { supabaseBrowser } from "@/lib/supabase/client";

function orderLabel(o: any) {
  if (o && o.order_number != null) return "#EB-" + o.order_number;
  if (o && o.id) return "#" + String(o.id).slice(0, 8).toUpperCase();
  return "#—";
}

function fmt(dt: string | null) {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDate(dt: string | null) {
  if (!dt) return "-";
  return new Date(dt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function money(n: any, currency?: string) {
  if (n == null) return "-";
  return "$" + Number(n).toFixed(2) + (currency && currency.toLowerCase() !== "usd" ? " " + currency.toUpperCase() : "");
}

function weightText(o: any) {
  const lb = o.weight_lb == null ? 0 : o.weight_lb;
  const oz = o.weight_oz == null ? 0 : o.weight_oz;
  return lb + " lb " + oz + " oz";
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

// Every label ships from the boutique; shown in the route strip at the top of the page.
const SHIP_FROM = { city: "Fontana, CA", zip: "92335" };

function fmtShort(dt: string | null) {
  if (!dt) return "";
  const d = new Date(dt);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

function groupTracking(n: string) {
  return n.replace(/(.{4})(?=.)/g, "$1 ");
}

function StatusPill({ order }: { order: any }) {
  let text = "Label purchased";
  let cls = "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200";
  let dot = "bg-emerald-700 dark:bg-emerald-300";
  if (order.delivered_at) {
    text = "Delivered";
  } else if (order.status === "draft") {
    text = "Draft";
    cls = "border border-dashed border-taupe/60 text-taupe";
    dot = "bg-taupe";
  } else if (order.status === "refunded") {
    text = "Refunded";
    cls = "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200";
    dot = "bg-red-700 dark:bg-red-300";
  }
  return (
    <span className={"inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] " + cls}>
      <span aria-hidden="true" className={"h-[7px] w-[7px] rounded-full " + dot} />
      {text}
    </span>
  );
}

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  print: "M6 9V3h12v6M5 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1M7 14h10v7H7z",
  track: "M3 12h4l3 8 4-16 3 8h4",
  copy: "M9 9h12v12H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  chevron: "m6 9 6 6 6-6",
  check: "m5 12 5 5 9-10",
  box: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
};

type Step = {
  key: string;
  title: string;
  detail?: string | null;
  at?: string | null;
  done: boolean;
  photo?: string | null;
};

function journeySteps(order: any): Step[] {
  const steps: Step[] = [];
  if (order.status === "draft") {
    steps.push({ key: "draft", title: "Draft started", at: order.created_at, done: true });
    steps.push({ key: "buy", title: "Buy the label", detail: "Finish the label to ship this order", done: false });
    return steps;
  }
  steps.push({
    key: "created",
    title: "Label created",
    detail: [order.provider ? "Purchased through " + order.provider : null, order.postage_amount != null ? money(order.postage_amount, order.postage_currency) : null]
      .filter(Boolean)
      .join(" · "),
    at: order.created_at,
    done: true,
  });
  steps.push(
    order.printed_at
      ? { key: "printed", title: "Printed", detail: order.printed_by ? "by " + order.printed_by : null, at: order.printed_at, done: true }
      : { key: "printed", title: "Not printed yet", done: false }
  );
  const packed = order.packed_at || order.package_photo_url;
  steps.push(
    packed
      ? {
          key: "packed",
          title: order.package_photo_url ? "Packed & photographed" : "Packed",
          detail: order.packed_by ? "by " + order.packed_by : null,
          at: order.packed_at,
          done: true,
          photo: order.package_photo_url,
        }
      : { key: "packed", title: "Not packed yet", done: false }
  );
  steps.push(
    order.customer_notified_at
      ? {
          key: "notified",
          title: "Customer notified",
          detail: order.notified_via ? "Sent via " + order.notified_via : null,
          at: order.customer_notified_at,
          done: true,
        }
      : { key: "notified", title: "Customer not notified yet", done: false }
  );
  if (order.status === "refunded") {
    steps.push({ key: "refunded", title: "Label refunded", detail: order.refund_status || null, done: true });
  } else if (order.delivered_at) {
    steps.push({ key: "delivered", title: "Delivered", at: order.delivered_at, done: true });
  } else if (order.tracking_number) {
    steps.push({
      key: "carrier",
      title: order.tracking_status ? "Carrier: " + order.tracking_status : "Awaiting carrier scan",
      detail: "Updates appear here once " + (order.carrier || "the carrier") + " scans the parcel",
      done: false,
    });
  }
  return steps;
}

function methodText(payment: any) {
  if (!payment) return "Manual";
  if (payment.method_brand) {
    const brand = payment.method_brand.charAt(0).toUpperCase() + payment.method_brand.slice(1);
    return brand + (payment.method_last4 ? " •••• " + payment.method_last4 : "");
  }
  if (payment.method) return payment.method;
  if (payment.payment_source === "clover") return "Clover";
  return "Stripe";
}

export default function OrderDetailPage() {
  const supabase = useMemo(function () {
    return supabaseBrowser();
  }, []);
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<any | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [lifetimeShipments, setLifetimeShipments] = useState<number | null>(null);
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    function () {
      function onDown(e: MouseEvent) {
        if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
          setActionsOpen(false);
        }
      }
      document.addEventListener("mousedown", onDown);
      return function () {
        document.removeEventListener("mousedown", onDown);
      };
    },
    []
  );

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("shipping_orders")
      .select("*")
      .eq("id", params.id)
      .single();
    setOrder(data || null);
    setLoading(false);
    return data;
  }

  useEffect(function () {
    load().then(function (o: any) {
      if (!o) return;

      // Lifetime shipments in this portal (email first, then name)
      (async function () {
        let count: number | null = null;
        if (o.to_email) {
          const res = await supabase
            .from("shipping_orders")
            .select("id", { count: "exact", head: true })
            .ilike("to_email", o.to_email);
          count = res.count;
        }
        if ((count == null || count === 0) && o.to_name) {
          const res = await supabase
            .from("shipping_orders")
            .select("id", { count: "exact", head: true })
            .ilike("to_name", o.to_name);
          count = res.count;
        }
        setLifetimeShipments(count == null ? 0 : count);
      })();

      // Matching customer's portal token (email first, then name)
      (async function () {
        let token: string | null = null;
        if (o.to_email) {
          const res = await supabase
            .from("shipping_customers")
            .select("portal_token")
            .ilike("email", o.to_email)
            .or("archived.is.null,archived.eq.false")
            .is("merged_into", null)
            .limit(1)
            .maybeSingle();
          token = res.data && res.data.portal_token ? res.data.portal_token : null;
        }
        if (!token && o.to_name) {
          const res = await supabase
            .from("shipping_customers")
            .select("portal_token")
            .ilike("name", o.to_name)
            .or("archived.is.null,archived.eq.false")
            .is("merged_into", null)
            .limit(1)
            .maybeSingle();
          token = res.data && res.data.portal_token ? res.data.portal_token : null;
        }
        setPortalToken(token);
      })();

      // Billing portal match
      (async function () {
        try {
          const res = await fetch("/api/billing-match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: o.to_email || "",
              name: o.to_name || "",
              street1: o.to_street1 || "",
              zip: o.to_zip || "",
            }),
          });
          const data = await res.json();
          setBilling(data);
        } catch {
          setBilling({ matched: false });
        }
        setBillingLoading(false);
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refund() {
    if (!order) return;
    if (!confirm("Refund/cancel the " + order.carrier + " label for " + order.to_name + "?")) return;
    setBusy("refund");
    const res = await fetch("/api/labels/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setMsg("Refund submitted to the carrier.");
    load();
  }

  async function deleteOrder() {
    if (!order) return;
    if (!confirm("Delete this order for " + (order.to_name || "unknown") + "? This can't be undone.")) return;
    setBusy("delete");
    const { error } = await supabase.from("shipping_orders").delete().eq("id", order.id);
    setBusy(null);
    if (error) {
      setMsg(error.message);
      return;
    }
    router.push("/orders");
  }

  async function printLabel() {
    if (!order) return;
    setBusy("print");
    try {
      const res = await fetch("/api/batch/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: [order.id], mark_printed: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
      load();
    } catch (e: any) {
      setMsg(e.message);
    }
    setBusy(null);
  }

  function copyNotification() {
    if (!order) return;
    // Same text Scan & Send and Muse send (lib/shipNotice.ts).
    const text = shippingNotice(order);
    navigator.clipboard.writeText(text);
    setMsg("Notification copied to clipboard.");
    setActionsOpen(false);
  }

  function copyTrackingLink() {
    if (!order || !order.tracking_number) return;
    navigator.clipboard.writeText("https://track.erendirasboutique.com/?tracking=" + order.tracking_number);
    setMsg("Tracking link copied to clipboard.");
    setActionsOpen(false);
  }

  function copyPortalLink() {
    if (!portalToken) return;
    navigator.clipboard.writeText("https://my.erendirasboutique.com/account?t=" + portalToken);
    setMsg("Portal link copied to clipboard.");
    setActionsOpen(false);
  }

  function copyTrackingNumber() {
    if (!order || !order.tracking_number) return;
    navigator.clipboard.writeText(order.tracking_number);
    setMsg("Tracking number copied to clipboard.");
  }

  if (loading) {
    return (
      <Shell>
        <p className="mt-10 text-sm text-ink/50">Loading order...</p>
      </Shell>
    );
  }

  if (!order) {
    return (
      <Shell>
        <p className="eyebrow">Order</p>
        <h1 className="mt-1 text-5xl">Not found</h1>
        <p className="mt-4 text-sm text-ink/60">This order doesn't exist or was deleted.</p>
        <button
          onClick={function () {
            router.push("/orders");
          }}
          className="btn-secondary mt-6"
        >
          Back to Orders
        </button>
      </Shell>
    );
  }

  const payment = billing && billing.matched ? billing.payment : null;
  const lifetimeSpend = billing && billing.lifetime ? billing.lifetime.total_spend : null;
  const steps = journeySteps(order);
  const canPrint = order.status === "purchased" && order.label_url;
  const hasCopyItems = !!order.tracking_number || !!portalToken || !!(payment && payment.receipt_url);
  const menuItem = "flex min-h-[44px] w-full items-center px-4 text-left text-sm text-ink hover:bg-cream/60";
  const card = "rounded-3xl border border-taupe/25 bg-white";
  const ghostBtn =
    "inline-flex h-11 items-center gap-2 rounded-full border border-taupe/40 bg-white px-[18px] text-sm text-ink transition-colors hover:bg-taupe/10 disabled:opacity-50";

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        {/* ------- header ------- */}
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-1.5">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] text-taupe">
              <button
                onClick={function () {
                  router.push("/orders");
                }}
                className="hover:underline"
              >
                Orders
              </button>
              <span aria-hidden="true">/</span>
              <span className="text-ink/70">{order.to_name || "Order"}</span>
            </nav>
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-5xl leading-none sm:text-6xl">{orderLabel(order)}</h1>
              <StatusPill order={order} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {order.tracking_number && (
              <a
                href={"https://track.erendirasboutique.com/?tracking=" + order.tracking_number}
                target="_blank"
                rel="noreferrer"
                className={ghostBtn}
              >
                <Icon d={ICONS.track} />
                Track
              </a>
            )}
            {hasCopyItems && (
              <div className="relative" ref={actionsRef}>
                <button
                  onClick={function () {
                    setActionsOpen(!actionsOpen);
                  }}
                  aria-expanded={actionsOpen}
                  aria-haspopup="menu"
                  className={ghostBtn}
                >
                  <Icon d={ICONS.copy} />
                  Copy
                  <Icon d={ICONS.chevron} size={14} />
                </button>
                {actionsOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-taupe/25 bg-white py-1.5 shadow-soft"
                  >
                    {order.tracking_number && (
                      <button role="menuitem" onClick={copyNotification} className={menuItem}>
                        Notification message
                      </button>
                    )}
                    {order.tracking_number && (
                      <button role="menuitem" onClick={copyTrackingLink} className={menuItem}>
                        Tracking link
                      </button>
                    )}
                    {portalToken && (
                      <button role="menuitem" onClick={copyPortalLink} className={menuItem}>
                        Customer portal link
                      </button>
                    )}
                    {payment && payment.receipt_url && (
                      <a role="menuitem" href={payment.receipt_url} target="_blank" rel="noreferrer" className={menuItem}>
                        View receipt
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
            {order.status === "draft" && (
              <button
                onClick={function () {
                  router.push("/create-label?draft=" + order.id);
                }}
                className="btn-primary h-11"
              >
                Continue label
              </button>
            )}
            {canPrint && (
              <button onClick={printLabel} disabled={busy !== null} className="btn-primary h-11">
                <Icon d={ICONS.print} />
                {busy === "print" ? "Opening..." : "Print label"}
              </button>
            )}
          </div>
        </header>

        {/* ------- notices ------- */}
        {order.rts_at && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e6c88f]/60 bg-[#fdf8ee] px-4 py-3 text-sm dark:bg-transparent">
            <span>
              <span className="font-medium">Returned to sender</span>
              {order.rts_reason ? ": " + order.rts_reason : ""}
              <span className="text-ink/50"> &middot; {fmt(order.rts_at)}</span>
            </span>
            <a href="/label-tools" className="text-taupe underline underline-offset-2">
              Re-ship
            </a>
          </div>
        )}
        {order.reship_of && (
          <div className="rounded-2xl bg-sand/25 px-4 py-3 text-sm text-ink/70">
            This is a re-ship of a package that came back.{" "}
            <a href={"/orders/" + order.reship_of} className="text-taupe underline underline-offset-2">
              See the original order
            </a>
          </div>
        )}
        {msg && (
          <button
            role="status"
            onClick={function () {
              setMsg(null);
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-left text-sm text-taupe"
          >
            <span>{msg}</span>
            <span className="text-xs text-ink/50">Dismiss</span>
          </button>
        )}

        {/* ------- route + summary ------- */}
        <section aria-label="Shipment summary" className={card + " flex flex-wrap items-center gap-x-12 gap-y-6 px-6 py-6 sm:px-8"}>
          <div className="flex min-w-0 flex-[999_1_420px] items-center gap-5">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-[0.08em] text-taupe">From</span>
              <span className="font-heading text-[28px] leading-tight text-ink">{SHIP_FROM.city}</span>
              <span className="text-[13px] text-ink/60">{SHIP_FROM.zip}</span>
            </div>
            <div aria-hidden="true" className="flex flex-1 basis-20 items-center gap-1.5 text-taupe">
              <span className="h-2 w-2 rounded-full bg-taupe" />
              <span className="flex-1 border-t-2 border-dashed border-sand" />
              <Icon d={ICONS.box} size={22} />
              <span className="flex-1 border-t-2 border-dashed border-sand" />
              <span className="h-2 w-2 rounded-full border-2 border-taupe" />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs uppercase tracking-[0.08em] text-taupe">To</span>
              <span className="font-heading text-[28px] leading-tight text-ink">
                {order.to_city ? order.to_city + ", " + (order.to_state || "") : "-"}
              </span>
              <span className="text-[13px] text-ink/60">{order.to_zip || ""}</span>
            </div>
          </div>
          <dl className="grid flex-[1_1_380px] grid-cols-3 gap-4 border-taupe/20 sm:border-l sm:pl-8">
            <div>
              <dt className="text-xs text-taupe">Carrier</dt>
              <dd className="mt-0.5">{order.carrier ? order.carrier + " " + (order.mail_class || "") : "Draft"}</dd>
            </div>
            <div>
              <dt className="text-xs text-taupe">Postage</dt>
              <dd className="mt-0.5">{money(order.postage_amount, order.postage_currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-taupe">Ordered</dt>
              <dd className="mt-0.5">{fmtDate(order.created_at)}</dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-wrap items-start gap-7">
          {/* ------- left column ------- */}
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-7">
            <section className={card + " px-6 py-7 sm:px-8"}>
              <h2 className="mb-6 text-[34px] leading-none">Journey</h2>
              <ol className="flex flex-col">
                {steps.map(function (s, i) {
                  const last = i === steps.length - 1;
                  return (
                    <li key={s.key} className={"relative grid grid-cols-[28px_minmax(0,1fr)_auto] gap-x-4" + (last ? "" : " pb-[22px]")}>
                      {!last && <span aria-hidden="true" className="absolute bottom-0 left-[13px] top-[22px] w-0.5 bg-taupe/20" />}
                      {s.done ? (
                        <span aria-hidden="true" className="relative z-[1] flex h-7 w-7 items-center justify-center rounded-full bg-taupe text-cream">
                          <Icon d={ICONS.check} size={14} />
                        </span>
                      ) : (
                        <span aria-hidden="true" className="relative z-[1] h-7 w-7 rounded-full border-2 border-dashed border-sand bg-white" />
                      )}
                      <div className="flex min-w-0 flex-col gap-3">
                        <div>
                          <div className={s.done ? "font-medium" : "font-medium text-ink/60"}>{s.title}</div>
                          {s.detail && <div className="break-words text-[13px] text-ink/60">{s.detail}</div>}
                        </div>
                        {s.photo && (
                          <a href={s.photo} target="_blank" rel="noreferrer" className="block max-w-[440px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={s.photo}
                              alt={"Packed parcel for " + (order.to_name || "this order")}
                              className="aspect-[1208/550] w-full rounded-xl border border-taupe/20 object-cover"
                            />
                          </a>
                        )}
                      </div>
                      {s.at ? (
                        <time dateTime={s.at} className="whitespace-nowrap text-[13px] text-ink/60">
                          {fmtShort(s.at)}
                        </time>
                      ) : (
                        <span />
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className={card + " flex flex-col gap-5 px-6 py-7 sm:px-8"}>
              <h2 className="text-[34px] leading-none">Package</h2>
              {order.tracking_number && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream/70 px-4 py-3.5">
                  <div className="min-w-0">
                    <div className="text-xs text-taupe">{(order.carrier || "Carrier") + " tracking"}</div>
                    <div className="break-all font-mono text-[17px] tracking-[0.04em]">{groupTracking(order.tracking_number)}</div>
                  </div>
                  <button onClick={copyTrackingNumber} aria-label="Copy tracking number" className={ghostBtn + " text-[13px]"}>
                    Copy
                  </button>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-taupe">Dimensions</dt>
                  <dd className="mt-0.5">
                    {order.length} &times; {order.width} &times; {order.height} in
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-taupe">Weight</dt>
                  <dd className="mt-0.5">{weightText(order)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-taupe">Signature</dt>
                  <dd className="mt-0.5">{order.signature_confirmation ? "Required" : "Not required"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-taupe">Provider</dt>
                  <dd className="mt-0.5 capitalize">{order.provider || "-"}</dd>
                </div>
                {order.refund_status && (
                  <div>
                    <dt className="text-xs text-taupe">Refund</dt>
                    <dd className="mt-0.5">{order.refund_status}</dd>
                  </div>
                )}
              </dl>
              {order.notes && (
                <div className="border-t border-taupe/15 pt-4">
                  <div className="text-xs text-taupe">Notes</div>
                  <p className="mt-1 whitespace-pre-wrap">{order.notes}</p>
                </div>
              )}
            </section>
          </div>

          {/* ------- right column ------- */}
          <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-7">
            <section className={card + " flex flex-col gap-5 p-7"}>
              <div className="flex items-center gap-3.5">
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cream font-heading text-[22px] text-taupe"
                >
                  {initials(order.to_name)}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-[28px] leading-tight">{order.to_name || "Unknown"}</h2>
                  <div className="text-[13px] text-ink/60">
                    {lifetimeShipments != null && lifetimeShipments > 1 ? "Returning customer" : "Customer"}
                  </div>
                </div>
              </div>
              <address className="not-italic leading-relaxed">
                {order.to_street1}
                {order.to_street2 ? (
                  <>
                    <br />
                    {order.to_street2}
                  </>
                ) : null}
                <br />
                {order.to_city}, {order.to_state} {order.to_zip}
              </address>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-cream/70 px-4 py-3.5">
                  <div className="text-xs text-taupe">Shipments</div>
                  <div className="font-heading text-[32px] leading-tight">{lifetimeShipments == null ? "..." : lifetimeShipments}</div>
                </div>
                <div className="rounded-2xl bg-cream/70 px-4 py-3.5">
                  <div className="text-xs text-taupe">Lifetime spend</div>
                  <div className="font-heading text-[32px] leading-tight">
                    {billingLoading ? "..." : lifetimeSpend != null && lifetimeSpend > 0 ? money(lifetimeSpend) : "—"}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1 border-t border-taupe/15 pt-4 text-[13px]">
                {order.to_email || order.to_phone ? (
                  <>
                    {order.to_email && <span className="break-all">{order.to_email}</span>}
                    {order.to_phone && <span>{order.to_phone}</span>}
                  </>
                ) : (
                  <span className="text-ink/60">No contact info on file</span>
                )}
              </div>
              {portalToken && (
                <button onClick={copyPortalLink} className={ghostBtn + " justify-center"}>
                  Copy customer portal link
                </button>
              )}
            </section>

            <section className={card + " flex flex-col gap-3 p-7"}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[28px] leading-none">Payment</h2>
                {billingLoading ? (
                  <span className="rounded-full bg-cream px-2.5 py-1 text-xs text-taupe">Checking...</span>
                ) : payment ? (
                  <span className="rounded-full bg-cream px-2.5 py-1 text-xs text-ink/80">Matched &middot; {billing.matchedBy}</span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
                    Paid manually
                  </span>
                )}
              </div>
              {payment ? (
                <dl className="mt-1 grid grid-cols-[100px_1fr] gap-y-2.5 text-[15px]">
                  <dt className="text-taupe">Amount</dt>
                  <dd>{money(payment.amount, payment.currency)}</dd>
                  <dt className="text-taupe">Method</dt>
                  <dd>{methodText(payment)}</dd>
                  <dt className="text-taupe">Status</dt>
                  <dd>{payment.status || "-"}</dd>
                  {payment.refund_status && (
                    <>
                      <dt className="text-taupe">Refund</dt>
                      <dd>{payment.refund_status}</dd>
                    </>
                  )}
                  {payment.description && (
                    <>
                      <dt className="text-taupe">Description</dt>
                      <dd>{payment.description}</dd>
                    </>
                  )}
                  <dt className="text-taupe">Paid</dt>
                  <dd>{fmt(payment.created_at)}</dd>
                  {payment.receipt_url && (
                    <>
                      <dt className="text-taupe">Receipt</dt>
                      <dd>
                        <a href={payment.receipt_url} target="_blank" rel="noreferrer" className="text-taupe underline underline-offset-2">
                          View receipt
                        </a>
                      </dd>
                    </>
                  )}
                </dl>
              ) : billingLoading ? (
                <p className="text-sm text-ink/60">Looking for a matching payment in the billing portal...</p>
              ) : (
                <p className="text-sm text-ink/60">
                  No matching charge in the billing portal &mdash; likely cash, in-person, or outside Stripe.
                </p>
              )}
            </section>

            <section aria-label="Danger zone" className="flex flex-col gap-1 rounded-3xl border border-dashed border-red-300/70 px-6 py-5">
              <span className="mb-1 text-xs uppercase tracking-[0.08em] text-ink/60">Danger zone</span>
              {order.status === "purchased" && (
                <button
                  onClick={refund}
                  disabled={busy !== null}
                  className="min-h-[44px] text-left text-sm text-red-700 hover:underline disabled:opacity-50 dark:text-red-300"
                >
                  {busy === "refund" ? "Refunding..." : "Cancel & refund label"}
                </button>
              )}
              <button
                onClick={deleteOrder}
                disabled={busy !== null}
                className="min-h-[44px] text-left text-sm text-red-700 hover:underline disabled:opacity-50 dark:text-red-300"
              >
                {busy === "delete" ? "Deleting..." : "Delete order"}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
