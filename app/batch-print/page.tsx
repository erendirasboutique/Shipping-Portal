"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function BatchPrintPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const [queue, setQueue] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const [{ data: q }, { data: h }] = await Promise.all([
      supabase
        .from("shipping_orders")
        .select("*")
        .eq("status", "purchased")
        .eq("print_status", "not_printed")
        .not("label_url", "is", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("shipping_orders")
        .select("*")
        .eq("print_status", "printed")
        .order("printed_at", { ascending: false })
        .limit(200),
    ]);
    setQueue(q ?? []);
    setHistory(h ?? []);
    setSelected(new Set());
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((s) => (s.size === queue.length ? new Set() : new Set(queue.map((o) => o.id))));
  }

  // Fetch merged PDF, open as blob URL in a new tab (no auto-download), mark printed.
  async function printSelected(ids: string[], markPrinted = true) {
    if (!ids.length) return;
    setBusy("print");
    setMsg(null);
    try {
      const res = await fetch("/api/batch/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: ids, mark_printed: markPrinted }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) setMsg("Pop-up blocked — allow pop-ups for this site to open merged PDFs.");
      load();
    } catch (e: any) {
      setMsg(e.message);
    }
    setBusy(null);
  }

  async function markUnprinted(order: any) {
    setBusy(order.id);
    const { error } = await supabase
      .from("shipping_orders")
      .update({ print_status: "not_printed", printed_at: null, printed_by: null })
      .eq("id", order.id);
    setBusy(null);
    if (error) return setMsg(error.message);
    load();
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Batch Print 🖨️</h1>
        <div className="flex rounded-full border border-sand bg-white p-1">
          <button onClick={() => setTab("queue")} className={`rounded-full px-4 py-1.5 text-sm ${tab === "queue" ? "bg-taupe text-cream" : "text-taupe"}`}>
            To print ({queue.length})
          </button>
          <button onClick={() => setTab("history")} className={`rounded-full px-4 py-1.5 text-sm ${tab === "history" ? "bg-taupe text-cream" : "text-taupe"}`}>
            Printed history
          </button>
        </div>
      </div>

      {msg && <p className="mt-4 cursor-pointer rounded-xl bg-sand/30 px-4 py-3 text-sm text-taupe" onClick={() => setMsg(null)}>{msg}</p>}

      {tab === "queue" ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={toggleAll} className="btn-secondary" disabled={!queue.length}>
              {selected.size === queue.length && queue.length ? "Clear selection" : "Select all"}
            </button>
            <button
              onClick={() => printSelected(Array.from(selected))}
              disabled={!selected.size || busy !== null}
              className="btn-primary"
            >
              {busy === "print" ? "Merging…" : `Print ${selected.size || ""} label${selected.size === 1 ? "" : "s"}`}
            </button>
          </div>

          <div className="card mt-4 overflow-x-auto !p-0">
            <table className="w-full min-w-[680px]">
              <thead className="border-b border-sand/60">
                <tr>
                  <th className="table-th w-10"></th>
                  <th className="table-th">Customer</th>
                  <th className="table-th">Carrier / Service</th>
                  <th className="table-th">Tracking</th>
                  <th className="table-th">Purchased</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((o) => (
                  <tr key={o.id} onClick={() => toggle(o.id)} className="cursor-pointer border-b border-sand/30 last:border-0 hover:bg-sand/15">
                    <td className="table-td">
                      <input type="checkbox" readOnly checked={selected.has(o.id)} className="h-4 w-4 accent-taupe" />
                    </td>
                    <td className="table-td font-medium">{o.to_name}</td>
                    <td className="table-td">{o.carrier} · {o.mail_class}</td>
                    <td className="table-td font-mono text-xs">{o.tracking_number}</td>
                    <td className="table-td text-ink/60">{new Date(o.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {!queue.length && (
                  <tr><td colSpan={5} className="table-td py-10 text-center text-ink/50">All caught up — no purchased labels waiting to print.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card mt-6 overflow-x-auto !p-0">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-sand/60">
              <tr>
                <th className="table-th">Customer</th>
                <th className="table-th">Tracking</th>
                <th className="table-th">Printed</th>
                <th className="table-th">By</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((o) => (
                <tr key={o.id} className="border-b border-sand/30 last:border-0">
                  <td className="table-td font-medium">{o.to_name}</td>
                  <td className="table-td font-mono text-xs">{o.tracking_number}</td>
                  <td className="table-td text-ink/60">{o.printed_at ? new Date(o.printed_at).toLocaleString() : "—"}</td>
                  <td className="table-td text-ink/60">{o.printed_by || "—"}</td>
                  <td className="table-td">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => printSelected([o.id], false)}
                        disabled={busy !== null}
                        className="btn-secondary !px-3 !py-1.5 !text-xs"
                      >
                        Reprint
                      </button>
                      <button
                        onClick={() => markUnprinted(o)}
                        disabled={busy !== null}
                        className="btn-secondary !px-3 !py-1.5 !text-xs"
                      >
                        {busy === o.id ? "…" : "Mark as unprinted"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!history.length && (
                <tr><td colSpan={5} className="table-td py-10 text-center text-ink/50">Nothing printed yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
