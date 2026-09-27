"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Shell from "@/components/Shell";
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

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-taupe/25 bg-white px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-[0.08em] text-taupe">{label}</p>
      <p className="mt-1 text-[15px] font-medium text-ink">{value}</p>
    </div>
  );
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
    const carrier = order.carrier || "the shipping carrier";
    const shipDate = new Date(order.updated_at || order.created_at || Date.now()).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const addressParts = [];
    if (order.to_street1) addressParts.push(order.to_street1);
    if (order.to_street2) addressParts.push(order.to_street2);
    addressParts.push(order.to_city + ", " + order.to_state + " " + order.to_zip);
    const address = addressParts.join("\n");
    const tn = order.tracking_number || "";
    const text =
      "A package was shipped to you via " + carrier + " and will be delivered to:\n\n" +
      (order.to_name || "") + "\n" +
      address + "\n\n" +
      "Shipment Date: " + shipDate + "\n" +
      "Mail Class: " + (order.mail_class || "") + "\n" +
      "Tracking Number: " + tn + "\n\n" +
      "Check the package status:\n" +
      "https://track.erendirasboutique.com/?tracking=" + tn + "\n\n" +
      "For questions about this package, please contact us or " + carrier + ".";
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

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            <button
              onClick={function () {
                router.push("/orders");
              }}
              className="hover:underline"
            >
              Orders
            </button>
            {" \u203a "}
            {order.to_name || "Order"}
          </p>
          <h1 className="mt-1 text-5xl">{orderLabel(order)}</h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={function () {
              router.push("/orders");
            }}
            className="btn-secondary"
          >
            Back
          </button>
          <div className="relative" ref={actionsRef}>
            <button
              onClick={function () {
                setActionsOpen(!actionsOpen);
              }}
              className="btn-primary"
            >
              Order Actions {actionsOpen ? "\u2303" : "\u2304"}
            </button>
            {actionsOpen && (
              <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-taupe/25 bg-white py-1.5 shadow-lg">
                {order.status === "purchased" && order.label_url && (
                  <button
                    onClick={function () {
                      setActionsOpen(false);
                      printLabel();
                    }}
                    disabled={busy !== null}
                    className="block w-full px-4 py-2.5 text-left text-sm hover:bg-cream/60"
                  >
                    {busy === "print" ? "Opening..." : "Print label"}
                  </button>
                )}
                {order.tracking_number && (
                  <a
                    href={"https://track.erendirasboutique.com/?tracking=" + order.tracking_number}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full px-4 py-2.5 text-left text-sm hover:bg-cream/60"
                  >
                    Track package
                  </a>
                )}
                {order.tracking_number && (
                  <button
                    onClick={copyNotification}
                    className="block w-full px-4 py-2.5 text-left text-sm hover:bg-cream/60"
                  >
                    Copy notification
                  </button>
                )}
                {order.tracking_number && (
                  <button
                    onClick={copyTrackingLink}
                    className="block w-full px-4 py-2.5 text-left text-sm hover:bg-cream/60"
                  >
                    Copy tracking link
                  </button>
                )}
                {portalToken && (
                  <button
                    onClick={copyPortalLink}
                    className="block w-full px-4 py-2.5 text-left text-sm hover:bg-cream/60"
                  >
                    Copy portal link
                  </button>
                )}
                {payment && payment.receipt_url && (
                  <a
                    href={payment.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full px-4 py-2.5 text-left text-sm hover:bg-cream/60"
                  >
                    View receipt
                  </a>
                )}
                {order.status === "draft" && (
                  <button
                    onClick={function () {
                      router.push("/create-label?draft=" + order.id);
                    }}
                    className="block w-full px-4 py-2.5 text-left text-sm hover:bg-cream/60"
                  >
                    Continue label
                  </button>
                )}
                <div className="my-1.5 border-t border-taupe/15" />
                {order.status === "purchased" && (
                  <button
                    onClick={function () {
                      setActionsOpen(false);
                      refund();
                    }}
                    disabled={busy !== null}
                    className="block w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"
                  >
                    {busy === "refund" ? "Refunding..." : "Cancel / refund label"}
                  </button>
                )}
                <button
                  onClick={function () {
                    setActionsOpen(false);
                    deleteOrder();
                  }}
                  disabled={busy !== null}
                  className="block w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"
                >
                  {busy === "delete" ? "Deleting..." : "Delete order"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {msg && (
        <p
          className="mt-4 cursor-pointer rounded-2xl bg-white px-4 py-3 text-sm text-taupe"
          onClick={function () {
            setMsg(null);
          }}
        >
          {msg}
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Order date" value={fmtDate(order.created_at)} />
        <StatCard label="Postage" value={money(order.postage_amount, order.postage_currency)} />
        <StatCard label="Package" value={weightText(order)} />
        <StatCard label="Carrier" value={order.carrier ? order.carrier + " " + (order.mail_class || "") : "Draft"} />
        <StatCard label="Status" value={<StatusPill status={order.status} />} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* ------- left column ------- */}
        <div className="space-y-5">
          <div className="rounded-3xl border border-taupe/25 bg-white p-6">
            <h2 className="text-2xl">Recipient</h2>
            <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-3 text-[15px] sm:grid-cols-[130px_1fr]">
              <dt className="text-taupe">Name</dt>
              <dd>{order.to_name || "-"}</dd>
              <dt className="text-taupe">Address</dt>
              <dd>
                {order.to_street1}
                {order.to_street2 ? (
                  <>
                    <br />
                    {order.to_street2}
                  </>
                ) : null}
                <br />
                {order.to_city}, {order.to_state} {order.to_zip}
              </dd>
              {order.to_phone && (
                <>
                  <dt className="text-taupe">Phone</dt>
                  <dd>{order.to_phone}</dd>
                </>
              )}
              {order.to_email && (
                <>
                  <dt className="text-taupe">Email</dt>
                  <dd className="break-all">{order.to_email}</dd>
                </>
              )}
            </dl>
          </div>

          <div className="rounded-3xl border border-taupe/25 bg-white p-6">
            <h2 className="text-2xl">Label &amp; tracking</h2>
            <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-3 text-[15px] sm:grid-cols-[130px_1fr]">
              <dt className="text-taupe">Dimensions</dt>
              <dd>
                {order.length} &times; {order.width} &times; {order.height} in
              </dd>
              <dt className="text-taupe">Weight</dt>
              <dd>{weightText(order)}</dd>
              <dt className="text-taupe">Signature</dt>
              <dd>{order.signature_confirmation ? "Required" : "Not required"}</dd>
              <dt className="text-taupe">Tracking</dt>
              <dd className="break-all">{order.tracking_number || "-"}</dd>
              <dt className="text-taupe">Provider</dt>
              <dd>{order.provider || "-"}</dd>
              <dt className="text-taupe">Created</dt>
              <dd>{fmt(order.created_at)}</dd>
              <dt className="text-taupe">Printed</dt>
              <dd>
                {fmt(order.printed_at)}
                {order.printed_by ? <span className="text-ink/50"> &middot; {order.printed_by}</span> : null}
              </dd>
              {order.refund_status && (
                <>
                  <dt className="text-taupe">Refund</dt>
                  <dd>{order.refund_status}</dd>
                </>
              )}
              {order.notes && (
                <>
                  <dt className="text-taupe">Notes</dt>
                  <dd className="whitespace-pre-wrap">{order.notes}</dd>
                </>
              )}
              {order.customer_notified_at && (
                <>
                  <dt className="text-taupe">Customer told</dt>
                  <dd>
                    {fmt(order.customer_notified_at)}
                    {order.notified_via ? <span className="text-ink/50"> &middot; {order.notified_via}</span> : null}
                  </dd>
                </>
              )}
            </dl>
            {order.package_photo_url && (
              <div className="mt-5">
                <p className="label">Package photo</p>
                <a href={order.package_photo_url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={order.package_photo_url} alt="Package" className="w-full rounded-2xl border border-taupe/20 object-cover" style={{ maxHeight: 420 }} />
                </a>
                <p className="mt-1.5 text-xs text-ink/50">
                  Packed {fmt(order.packed_at)}
                  {order.packed_by ? " \u00b7 " + order.packed_by : ""}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ------- right column ------- */}
        <div className="space-y-5">
          <div className="rounded-3xl border border-taupe/25 bg-white p-6">
            <h2 className="text-2xl">Customer</h2>
            <div className="mt-4 flex items-center gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream text-sm text-taupe">
                {initials(order.to_name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">{order.to_name || "Unknown"}</p>
                <p className="truncate text-xs text-ink/60">{order.to_email || order.to_phone || "No contact info"}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-cream/60 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-taupe">Lifetime shipments</p>
                <p className="mt-1 text-xl font-medium">
                  {lifetimeShipments == null ? "..." : lifetimeShipments}
                </p>
              </div>
              <div className="rounded-2xl bg-cream/60 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-taupe">Lifetime spend</p>
                <p className="mt-1 text-xl font-medium">
                  {billingLoading ? "..." : lifetimeSpend != null && lifetimeSpend > 0 ? money(lifetimeSpend) : "\u2014"}
                </p>
              </div>
            </div>
            {portalToken && (
              <button onClick={copyPortalLink} className="btn-secondary mt-4 w-full">
                Copy portal link
              </button>
            )}
          </div>

          <div className="rounded-3xl border border-taupe/25 bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl">Payment</h2>
              {billingLoading ? (
                <span className="rounded-full bg-cream px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-taupe">
                  checking...
                </span>
              ) : payment ? (
                <span className="rounded-full border border-taupe/45 bg-cream px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-ink/80">
                  matched &middot; {billing.matchedBy}
                </span>
              ) : (
                <span className="rounded-full border border-dashed border-taupe/50 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-taupe">
                  manual
                </span>
              )}
            </div>

            {payment ? (
              <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-3 text-[15px] sm:grid-cols-[130px_1fr]">
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
                      <a href={payment.receipt_url} target="_blank" rel="noreferrer" className="underline">
                        View receipt
                      </a>
                    </dd>
                  </>
                )}
              </dl>
            ) : billingLoading ? (
              <p className="mt-4 text-sm text-ink/50">Looking for a matching payment in the billing portal...</p>
            ) : (
              <p className="mt-4 text-sm text-ink/60">
                No matching payment found in the billing portal. This order was likely paid manually (cash, in-person, or
                outside Stripe).
              </p>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
