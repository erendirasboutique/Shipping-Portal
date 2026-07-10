"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";

function StatusText({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "draft",
    purchased: "label_purchased",
    refunded: "refunded",
  };
  return <span className="text-sm text-ink/60">{map[status] || status}</span>;
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

function weightText(o: any) {
  const lb = o.weight_lb == null ? 0 : o.weight_lb;
  const oz = o.weight_oz == null ? 0 : o.weight_oz;
  return lb + " lb " + oz + " oz";
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

export default function OrdersPage() {
  const supabase = useMemo(function () {
    return supabaseBrowser();
  }, []);
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("shipping_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setOrders(data || []);
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

  const shown = orders.filter(function (o) {
    if (filter === "draft" && o.status !== "draft") return false;
    if (filter === "refunded" && o.status !== "refunded") return false;
    if (filter === "to_print" && !(o.status === "purchased" && o.print_status === "not_printed")) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    const name = (o.to_name || "").toLowerCase();
    const tn = (o.tracking_number || "").toLowerCase();
    const city = (o.to_city || "").toLowerCase();
    return name.includes(s) || tn.includes(s) || city.includes(s);
  });

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

  async function refund(order: any) {
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
    setSelected(null);
    load();
  }

  async function deleteOrder(order: any) {
    if (!confirm("Delete this order for " + (order.to_name || "unknown") + "? This can't be undone.")) return;
    setBusy("delete");
    const { error } = await supabase.from("shipping_orders").delete().eq("id", order.id);
    setBusy(null);
    if (error) {
      setMsg(error.message);
      return;
    }
    setSelected(null);
    load();
  }

  async function printLabel(order: any) {
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

  function copyNotification(order: any) {
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
  }

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

      <div className="mt-5">
        <input
          className="input !rounded-full"
          placeholder="Search name, tracking, city..."
          value={q}
          onChange={function (e) {
            setQ(e.target.value);
          }}
        />
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
                      setSelected(o);
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
      {!groups.length && (
        <p className="mt-7 rounded-3xl border border-taupe/25 bg-white px-6 py-12 text-center text-sm text-ink/50">
          No orders match. Create a label to get started.
        </p>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={function () {
            setSelected(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-8"
            onClick={function (e) {
              e.stopPropagation();
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-4xl">{selected.to_name || "Order"}</h2>
                <p className="mt-1 text-sm text-ink/70">Full label, tracking, package, and customer details.</p>
              </div>
              <button
                onClick={function () {
                  setSelected(null);
                }}
                className="text-2xl leading-none text-ink/60"
              >
                &times;
              </button>
            </div>

            <dl className="mt-7 grid grid-cols-[110px_1fr] gap-y-4 text-[15px] sm:grid-cols-[140px_1fr]">
              <dt className="text-taupe">Address</dt>
              <dd>
                {selected.to_street1}
                {selected.to_street2 ? (
                  <>
                    <br />
                    {selected.to_street2}
                  </>
                ) : null}
                <br />
                {selected.to_city}, {selected.to_state}, {selected.to_zip}
              </dd>

              <dt className="text-taupe">Package</dt>
              <dd>
                {selected.length} &times; {selected.width} &times; {selected.height} in &middot; {weightText(selected)}
              </dd>

              <dt className="text-taupe">Carrier</dt>
              <dd>{selected.carrier || "-"}</dd>

              <dt className="text-taupe">Service</dt>
              <dd>{selected.mail_class || "-"}</dd>

              <dt className="text-taupe">Postage</dt>
              <dd>
                {selected.postage_amount != null
                  ? "$" + Number(selected.postage_amount).toFixed(2) + " " + (selected.postage_currency || "USD")
                  : "-"}
              </dd>

              <dt className="text-taupe">Created</dt>
              <dd>{fmt(selected.created_at)}</dd>

              <dt className="text-taupe">Printed</dt>
              <dd>
                {fmt(selected.printed_at)}
                {selected.printed_by ? <span className="text-ink/50"> &middot; {selected.printed_by}</span> : null}
              </dd>

              <dt className="text-taupe">Tracking</dt>
              <dd className="break-all">{selected.tracking_number || "-"}</dd>

              <dt className="text-taupe">Status</dt>
              <dd>
                <StatusText status={selected.status} />
              </dd>

              <dt className="text-taupe">Refund</dt>
              <dd>{selected.refund_status || "-"}</dd>

              <dt className="text-taupe">Notes</dt>
              <dd className="whitespace-pre-wrap">{selected.notes || "-"}</dd>
            </dl>

            <div className="mt-8 flex flex-wrap gap-2.5">
              {selected.status === "purchased" && selected.label_url && (
                <button
                  onClick={function () {
                    printLabel(selected);
                  }}
                  disabled={busy !== null}
                  className="btn-primary"
                >
                  {busy === "print" ? "Opening..." : "Print Label"}
                </button>
              )}
              {selected.tracking_number && (
                <a
                  href={"https://track.erendirasboutique.com/?tracking=" + selected.tracking_number}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                >
                  Track Package
                </a>
              )}
              {selected.tracking_number && (
                <button
                  onClick={function () {
                    copyNotification(selected);
                  }}
                  className="btn-primary"
                >
                  Copy Notification
                </button>
              )}
              {selected.status === "purchased" && (
                <button
                  onClick={function () {
                    refund(selected);
                  }}
                  disabled={busy !== null}
                  className="btn-danger"
                >
                  {busy === "refund" ? "Refunding..." : "Cancel / Refund Label"}
                </button>
              )}
              {selected.status === "draft" && (
                <button
                  onClick={function () {
                    router.push("/create-label?draft=" + selected.id);
                  }}
                  className="btn-primary"
                >
                  Continue Label
                </button>
              )}
              <button
                onClick={function () {
                  deleteOrder(selected);
                }}
                disabled={busy !== null}
                className="btn-danger"
              >
                {busy === "delete" ? "Deleting..." : "Delete Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

