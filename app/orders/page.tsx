"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";

function fmt(dt: string | null) {
  return dt ? new Date(dt).toLocaleString() : "—";
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-sand/40 text-taupe",
    purchased: "bg-emerald-100 text-emerald-800",
    refunded: "bg-red-100 text-red-700",
  };
  return <span className={`pill ${styles[status] || "bg-sand/40 text-taupe"}`}>{status}</span>;
}

export default function OrdersPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Record<string, any>>({});
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
    setOrders(data ?? []);
    const ids = Array.from(new Set((data ?? []).map((o) => o.customer_id).filter(Boolean)));
    if (ids.length) {
      const { data: cs } = await supabase.from("shipping_customers").select("*").in("id", ids);
      setCustomers(Object.fromEntries((cs ?? []).map((c) => [c.id, c])));
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = orders.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      (o.to_name || "").toLowerCase().includes(s) ||
      (o.tracking_number || "").toLowerCase().includes(s) ||
      (o.to_city || "").toLowerCase().includes(s)
    );
  });

  async function refund(order: any) {
    if (!confirm(`Refund/cancel the ${order.carrier} label for ${order.to_name}?`)) return;
    setBusy("refund");
    const res = await fetch("/api/labels/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: order.id, shipment_id: order.easypost_shipment_id }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return setMsg(data.error);
    setMsg("Refund submitted to the carrier.");
    setSelected(null);
    load();
  }

  async function deleteOrder(order: any) {
    if (!confirm(`Delete this order for ${order.to_name || "unknown"}? This can't be undone.`)) return;
    setBusy("delete");
    const { error } = await supabase.from("shipping_orders").delete().eq("id", order.id);
    setBusy(null);
    if (error) return setMsg(error.message);
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
      if (!res.ok) throw new Error((await res.json()).error);
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
    const shipDate = new Date(order.updated_at || order.created_at || Date.now())
      .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const address = [
      order.to_street1,
      order.to_street2,
      `${order.to_city}, ${order.to_state} ${order.to_zip}`,
    ]
      .filter(Boolean)
      .join("\n");
    const text = `A package was shipped to you via ${carrier} and will be delivered to:

${order.to_name || ""}
${address}

Shipment Date: ${shipDate}
Mail Class: ${order.mail_class || ""}
Tracking Number: ${order.tracking_number || ""}

Check the package status:
https://track.erendirasboutique.com/?tracking=${order.tracking_number || ""}

For questions about this package, please contact us or ${carrier}.`;
    navigator.clipboard.writeText(text);
    setMsg("Notification copied to clipboard.");
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Orders</h1>
        <div className="flex flex-wrap gap-2">
          <input className="input !w-64" placeholder="Search name, tracking, city…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input !w-40" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="draft">Drafts</option>
            <option value="purchased">Purchased</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {msg && (
        <p className="mt-4 rounded-xl bg-sand/30 px-4 py-3 text-sm text-taupe" onClick={() => setMsg(null)}>
          {msg}
        </p>
      )}

      <div className="card mt-6 overflow-x-auto !p-0">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-sand/60">
            <tr>
              <th className="table-th">Customer</th>
              <th className="table-th">Destination</th>
              <th className="table-th">Carrier / Service</th>
              <th className="table-th">Tracking</th>
              <th className="table-th">Status</th>
              <th className="table-th">Created</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((o) => (
              <tr key={o.id} onClick={() => setSelected(o)} className="cursor-pointer border-b border-sand/30 last:border-0 hover:bg-sand/15">
                <td className="table-td font-medium">{o.to_name || "—"}</td>
                <td className="table-td">{[o.to_city, o.to_state].filter(Boolean).join(", ") || "—"}</td>
                <td className="table-td">{o.carrier ? `${o.carrier} · ${o.mail_class}` : "—"}</td>
                <td className="table-td font-mono text-xs">{o.tracking_number || "—"}</td>
                <td className="table-td"><StatusPill status={o.status} /></td>
                <td className="table-td text-ink/60">{new Date(o.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td className="table-td py-10 text-center text-ink/50" colSpan={6}>No orders match. Create a label to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Order modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-cream p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl">{selected.to_name || "Order"}</h2>
                <div className="mt-1"><StatusPill status={selected.status} /></div>
              </div>
              <button onClick={() => setSelected(null)} className="text-2xl leading-none text-taupe">×</button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="card !p-4">
                <p className="label">Customer</p>
                {(() => {
                  const c = selected.customer_id ? customers[selected.customer_id] : null;
                  return (
                    <div className="text-sm">
                      <p className="font-medium">{c?.name || selected.to_name || "—"}</p>
                      <p className="text-ink/70">{c?.email || selected.to_email || ""}</p>
                      <p className="text-ink/70">{c?.phone || selected.to_phone || ""}</p>
                    </div>
                  );
                })()}
              </div>
              <div className="card !p-4">
                <p className="label">Address</p>
                <div className="text-sm text-ink/80">
                  <p>{selected.to_street1}</p>
                  {selected.to_street2 && <p>{selected.to_street2}</p>}
                  <p>{selected.to_city}, {selected.to_state} {selected.to_zip}</p>
                </div>
              </div>
              <div className="card !p-4">
                <p className="label">Package</p>
                <p className="text-sm">{selected.length} × {selected.width} × {selected.height} in</p>
                <p className="text-sm">{selected.weight_lb} lb {selected.weight_oz} oz</p>
                {selected.signature_confirmation && <p className="mt-1 text-xs text-taupe">Signature required</p>}
              </div>
              <div className="card !p-4">
                <p className="label">Shipping</p>
                <p className="text-sm">{selected.carrier ? `${selected.carrier} · ${selected.mail_class}` : "Not purchased"}</p>
                <p className="text-sm">{selected.postage_amount != null ? `$${Number(selected.postage_amount).toFixed(2)} ${selected.postage_currency}` : ""}</p>
                <p className="mt-1 break-all font-mono text-xs">{selected.tracking_number || ""}</p>
                {selected.refund_status && <p className="mt-1 text-xs text-red-700">Refund: {selected.refund_status}</p>}
              </div>
              <div className="card !p-4">
                <p className="label">Timeline</p>
                <p className="text-sm">Created: {fmt(selected.created_at)}</p>
                <p className="text-sm">Printed: {fmt(selected.printed_at)}</p>
                {selected.printed_by && <p className="text-xs text-ink/60">by {selected.printed_by}</p>}
              </div>
              <div className="card !p-4">
                <p className="label">Notes</p>
                <p className="whitespace-pre-wrap text-sm text-ink/80">{selected.notes || "—"}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {selected.status === "purchased" && selected.label_url && (
                <button onClick={() => printLabel(selected)} disabled={busy !== null} className="btn-primary">
                  {busy === "print" ? "Opening…" : "Print Label"}
                </button>
              )}
              {selected.tracking_url && (
                <a href={selected.tracking_url} target="_blank" rel="noreferrer" className="btn-secondary">Track Package</a>
              )}
              {selected.tracking_number && (
                <button onClick={() => copyNotification(selected)} className="btn-secondary">Copy Notification</button>
              )}
              {selected.status === "purchased" && (
                <button onClick={() => refund(selected)} disabled={busy !== null} className="btn-danger">
                  {busy === "refund" ? "Refunding…" : "Refund / Cancel Label"}
                </button>
              )}
              {selected.status === "draft" && (
                <button onClick={() => router.push(`/create-label?draft=${selected.id}`)} className="btn-primary">
                  Continue Label
                </button>
              )}
              <button onClick={() => deleteOrder(selected)} disabled={busy !== null} className="btn-danger">
                {busy === "delete" ? "Deleting…" : "Delete Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
