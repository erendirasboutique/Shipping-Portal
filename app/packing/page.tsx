"use client";

// Packing List — every label bought this week, and whether it's been
// packed (scanned + photographed) and sent to the customer yet.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";

type Row = {
  id: string;
  order_number: number | null;
  to_name: string | null;
  to_city: string | null;
  to_state: string | null;
  carrier: string | null;
  mail_class: string | null;
  tracking_number: string | null;
  created_at: string;
  packed_at: string | null;
  packed_by: string | null;
  package_photo_url: string | null;
  customer_notified_at: string | null;
  notified_via: string | null;
};

type Range = "week" | "today" | "14d";
type Filter = "todo" | "packed" | "all";

function sinceFor(range: Range) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === "week") d.setDate(d.getDate() - d.getDay()); // back to Sunday
  if (range === "14d") d.setDate(d.getDate() - 13);
  return d.toISOString();
}

function label(o: Row) {
  return o.order_number != null ? "EB-" + o.order_number : "#" + o.id.slice(0, 6).toUpperCase();
}

function when(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function who(email: string | null) {
  return email ? email.split("@")[0] : "";
}

export default function PackingPage() {
  const [range, setRange] = useState<Range>("week");
  const [filter, setFilter] = useState<Filter>("todo");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/packing?since=" + encodeURIComponent(sinceFor(range)), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load the packing list.");
      setRows(data.orders || []);
      setErr(null);
      setUpdatedAt(new Date());
    } catch (e: any) {
      setErr(e.message);
    }
  }, [range]);

  // Live: refresh every 20 seconds and whenever the tab comes back into view.
  useEffect(() => {
    setRows(null);
    load();
    const t = setInterval(load, 20000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  async function setPacked(o: Row, packed: boolean) {
    setSaving(o.id);
    try {
      const res = await fetch("/api/packing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: o.id, packed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save.");
      setRows((list) =>
        (list || []).map((r) => (r.id === o.id ? { ...r, packed_at: data.packed_at, packed_by: data.packed_by } : r))
      );
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(null);
    }
  }

  const all = rows || [];
  const packedCount = all.filter((o) => o.packed_at).length;
  const sentCount = all.filter((o) => o.customer_notified_at).length;
  const total = all.length;
  const pct = total ? Math.round((packedCount / total) * 100) : 0;

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all
      .filter((o) => (filter === "todo" ? !o.packed_at : filter === "packed" ? !!o.packed_at : true))
      .filter((o) =>
        !s
          ? true
          : [o.to_name, o.to_city, label(o), o.tracking_number].some((v) => (v || "").toLowerCase().includes(s))
      );
  }, [all, filter, q]);

  return (
    <Shell>
      <div className="card !rounded-[2rem] !p-6 md:!p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Packing day</p>
            <h1 className="mt-1 text-5xl">Packing List</h1>
          </div>
          <Link href="/scan" className="btn-primary !px-6 !py-3">Open Scan &amp; Send</Link>
        </div>

        {/* Range */}
        <div className="mt-5 flex flex-wrap gap-2">
          {([
            ["week", "This week"],
            ["today", "Today"],
            ["14d", "Last 14 days"],
          ] as [Range, string][]).map(([id, text]) => (
            <button
              key={id}
              onClick={() => setRange(id)}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                range === id ? "border-taupe bg-taupe text-cream dark:text-[#26211b]" : "border-taupe/30 text-taupe hover:bg-taupe/10"
              }`}
            >
              {text}
            </button>
          ))}
        </div>

        {/* Progress */}
        <div className="mt-5 rounded-3xl bg-cream/70 p-5 dark:bg-transparent dark:ring-1 dark:ring-taupe/20">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-heading text-4xl text-taupe">
              {rows ? packedCount : "–"} <span className="text-2xl text-ink/50">of {rows ? total : "–"} packed</span>
            </p>
            <p className="text-sm text-ink/60">
              {rows ? total - packedCount : "–"} left · {rows ? sentCount : "–"} customers told
            </p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-sand/30">
            <div className="h-full rounded-full bg-taupe transition-all" style={{ width: pct + "%" }} />
          </div>
          {rows && total > 0 && packedCount === total && (
            <p className="mt-3 text-sm font-medium text-[#4c7a3a] dark:text-[#a9cf98]">Everything is packed. 🎉</p>
          )}
        </div>

        {/* Filter + search */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {([
            ["todo", "To pack", rows ? total - packedCount : null],
            ["packed", "Packed", rows ? packedCount : null],
            ["all", "All", rows ? total : null],
          ] as [Filter, string, number | null][]).map(([id, text, n]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                filter === id ? "border-taupe/60 bg-white text-ink shadow-soft" : "border-taupe/15 text-ink/70 hover:border-taupe/40"
              }`}
            >
              {text}
              {n != null ? <span className="ml-1.5 text-taupe">{n}</span> : null}
            </button>
          ))}
          <input
            className="input !w-auto min-w-[12rem] flex-1"
            placeholder="Search name, city, EB #"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {err && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}

        {/* List */}
        <div className="mt-5 space-y-2.5">
          {!rows && !err && <p className="py-8 text-center text-sm text-ink/50">Loading…</p>}
          {rows && !shown.length && (
            <p className="rounded-3xl border border-taupe/10 bg-cream/70 px-5 py-8 text-center text-sm text-ink/50 dark:bg-transparent">
              {filter === "todo" && total > 0
                ? "Nothing left to pack."
                : q
                ? "No matches."
                : "No labels bought in this range yet."}
            </p>
          )}
          {shown.map((o) => {
            const packed = !!o.packed_at;
            const sent = !!o.customer_notified_at;
            return (
              <div
                key={o.id}
                className={`flex items-center gap-3.5 rounded-3xl border px-4 py-3.5 ${
                  packed ? "border-taupe/10 bg-cream/50 dark:bg-transparent" : "border-taupe/25 bg-white"
                }`}
              >
                {o.package_photo_url ? (
                  <a href={o.package_photo_url} target="_blank" rel="noreferrer" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.package_photo_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                  </a>
                ) : (
                  <span
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 ${
                      packed ? "border-taupe/30 text-taupe" : "border-dashed border-taupe/40 text-taupe/60"
                    }`}
                  >
                    {packed ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12.5l4.5 4.5L19 7" />
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M3 8l9-5 9 5v8l-9 5-9-5z M3 8l9 5 9-5 M12 13v8" />
                      </svg>
                    )}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">
                    {o.to_name || "Customer"} <span className="font-normal text-ink/50">· {label(o)}</span>
                  </p>
                  <p className="truncate text-sm text-ink/60">
                    {[o.to_city, o.to_state].filter(Boolean).join(", ")}
                    {o.carrier ? " · " + [o.carrier, o.mail_class].filter(Boolean).join(" ") : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                    {packed ? (
                      <span className="rounded-full bg-[#e6efdf] px-2 py-0.5 text-[#3f6a2e] dark:bg-transparent dark:text-[#a9cf98] dark:ring-1 dark:ring-[#a9cf98]/40">
                        Packed {when(o.packed_at)}{o.packed_by ? " · " + who(o.packed_by) : ""}
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#fbf1dc] px-2 py-0.5 text-[#7a5a1e] dark:bg-transparent dark:text-[#e6c88f] dark:ring-1 dark:ring-[#e6c88f]/40">
                        Not packed
                      </span>
                    )}
                    {sent && (
                      <span className="rounded-full bg-sand/30 px-2 py-0.5 text-taupe">
                        Sent{o.notified_via ? " · " + o.notified_via : ""}
                      </span>
                    )}
                    {packed && !o.package_photo_url && (
                      <span className="rounded-full bg-sand/30 px-2 py-0.5 text-ink/60">No photo</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {!packed || !sent ? (
                    <Link
                      href={"/scan?code=" + encodeURIComponent(o.order_number != null ? "EB-" + o.order_number : o.tracking_number || "")}
                      className="btn-secondary !px-4 !py-2 text-xs"
                    >
                      {packed ? "Send" : "Pack"}
                    </Link>
                  ) : null}
                  <button
                    onClick={() => setPacked(o, !packed)}
                    disabled={saving === o.id}
                    className="text-[11px] text-taupe underline underline-offset-2 disabled:opacity-50"
                  >
                    {saving === o.id ? "…" : packed ? "Undo" : "Mark packed"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {updatedAt && (
          <p className="mt-4 text-center text-xs text-ink/40">
            Updates automatically · last checked {updatedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })}
          </p>
        )}
      </div>
    </Shell>
  );
}
