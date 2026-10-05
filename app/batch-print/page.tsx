"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Figtree } from "next/font/google";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";

const ui = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

// Every merged PDF is kept in this Supabase Storage bucket and listed in this table.
const BATCH_BUCKET = "label-batches";
const BATCH_TABLE = "print_batches";

const PRINT_ICON =
  "M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z";

function Icon({ d, size = 18, width = 1.8 }: { d: string; size?: number; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function initials(name?: string) {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function shortDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Safari can't print a PDF from a hidden frame, so it opens a tab instead.
function isSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|Android/.test(ua);
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid min-w-[22px] place-items-center rounded-md border border-[#e3d9ce] bg-white px-1.5 font-sans text-[11px] font-semibold text-[#6f5c49] dark:border-[#3a2f27] dark:bg-[#251e18] dark:text-[#c9ab8a]">
      {children}
    </kbd>
  );
}

export default function BatchPrintPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [tab, setTab] = useState<"queue" | "history" | "saved">("queue");
  const [queue, setQueue] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [markAfter, setMarkAfter] = useState(true);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  async function load() {
    const [{ data: q }, { data: h }, { data: b }] = await Promise.all([
      supabase
        .from("shipping_orders")
        .select("*")
        .eq("status", "purchased")
        .eq("print_status", "not_printed")
        .not("label_url", "is", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("shipping_orders")
        .select("*")
        .eq("print_status", "printed")
        .order("printed_at", { ascending: false })
        .limit(200),
      (supabase as any).from(BATCH_TABLE).select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setQueue(q ?? []);
    setHistory(h ?? []);
    setBatches(b ?? []);
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

  const toggleAll = useCallback(() => {
    setSelected((s) => (s.size === queue.length ? new Set() : new Set(queue.map((o) => o.id))));
  }, [queue]);

  // Opens the print dialog directly with the merged PDF (Chrome/Edge).
  // Safari, or a blocked frame, falls back to opening the PDF in a new tab.
  function sendToPrinter(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const openTab = () => {
      const win = window.open(url, "_blank");
      if (!win) setMsg("Pop-up blocked — allow pop-ups for this site to open merged PDFs.");
    };
    if (isSafari()) return openTab();

    frameRef.current?.remove();
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    frame.src = url;
    frame.onload = () => {
      setTimeout(() => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          openTab();
        }
      }, 300);
    };
    document.body.appendChild(frame);
    frameRef.current = frame;
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  }

  async function printSelected(ids: string[], markPrinted = true, reprint = false) {
    if (!ids.length || busy) return;
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
      sendToPrinter(blob);
      const saved = await saveBatch(blob, ids, reprint);
      if (!saved) setMsg("Printed, but the PDF copy couldn't be saved to Saved PDFs.");
      load();
    } catch (e: any) {
      setMsg(e.message);
    }
    setBusy(null);
  }

  // Keeps a copy of the merged PDF so it can be reopened later from Saved PDFs.
  async function saveBatch(blob: Blob, ids: string[], reprint: boolean) {
    try {
      const orders = [...queue, ...history].filter((o) => ids.includes(o.id));
      const now = new Date();
      const day = now.toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
      const time = now.toLocaleTimeString("en-GB").replace(/:/g, "");
      const path = `${day}/${day}_${time}_${ids.length}-labels.pdf`;
      const { error: upErr } = await supabase.storage
        .from(BATCH_BUCKET)
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;
      const { data: userData } = await supabase.auth.getUser();
      const { error: rowErr } = await (supabase as any).from(BATCH_TABLE).insert({
        file_path: path,
        label_count: ids.length,
        order_ids: ids.map(String),
        customer_names: orders.map((o) => o.to_name).filter(Boolean),
        reprint,
        created_by: userData.user?.email ?? null,
      });
      if (rowErr) throw rowErr;
      return true;
    } catch (e) {
      console.error("Saving batch PDF failed", e);
      return false;
    }
  }

  async function openBatch(b: any) {
    const { data, error } = await supabase.storage.from(BATCH_BUCKET).createSignedUrl(b.file_path, 60 * 60);
    if (error || !data) return setMsg(error?.message ?? "Couldn't open that PDF.");
    const win = window.open(data.signedUrl, "_blank");
    if (!win) setMsg("Pop-up blocked — allow pop-ups for this site to open PDFs.");
  }

  async function printBatch(b: any) {
    setBusy(b.id);
    const { data, error } = await supabase.storage.from(BATCH_BUCKET).download(b.file_path);
    setBusy(null);
    if (error || !data) return setMsg(error?.message ?? "Couldn't load that PDF.");
    sendToPrinter(data);
  }

  async function downloadBatch(b: any) {
    const { data, error } = await supabase.storage
      .from(BATCH_BUCKET)
      .createSignedUrl(b.file_path, 60 * 60, { download: b.file_path.split("/").pop() });
    if (error || !data) return setMsg(error?.message ?? "Couldn't download that PDF.");
    window.location.href = data.signedUrl;
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

  // Keyboard shortcuts on the To print tab: P = print, A = select all, Esc = clear.
  // P with nothing selected prints everything in the queue.
  const printRef = useRef<() => void>(() => {});
  printRef.current = () => {
    const ids = selected.size ? Array.from(selected) : queue.map((o) => o.id);
    printSelected(ids, markAfter);
  };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (tab !== "queue" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      const key = e.key.toLowerCase();
      if (key === "p") {
        e.preventDefault();
        printRef.current();
      } else if (key === "a") {
        e.preventDefault();
        toggleAll();
      } else if (key === "escape") {
        setSelected(new Set());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, toggleAll]);

  const picked = queue.filter((o) => selected.has(o.id));
  const printCount = selected.size || queue.length;
  const allOn = queue.length > 0 && selected.size === queue.length;

  return (
    <Shell>
      <div className={`${ui.className} flex flex-col gap-6 text-[#2f261f] lg:flex-row dark:text-[#f1e9e0]`}>
        <section className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-4xl">Batch Print</h1>
            <div role="tablist" className="flex gap-1 rounded-xl bg-[#ece5dd] p-1 dark:bg-[#2a211b]">
              {(["queue", "history", "saved"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`h-9 rounded-[9px] px-3.5 text-[13.5px] ${
                    tab === t
                      ? "bg-white font-semibold text-[#2f261f] shadow-sm dark:bg-[#3a2f27] dark:text-white"
                      : "text-[#6f6156] dark:text-[#b8a796]"
                  }`}
                >
                  {t === "queue" ? `To print · ${queue.length}` : t === "history" ? "History" : "Saved PDFs"}
                </button>
              ))}
            </div>
          </div>

          {msg && (
            <button onClick={() => setMsg(null)} className="rounded-xl bg-[#efe6dc] px-4 py-3 text-left text-sm text-[#6f5c49] dark:bg-[#2e251e] dark:text-[#d6c9bb]">
              {msg}
            </button>
          )}

          {tab === "queue" ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-1">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
                  <input type="checkbox" checked={allOn} onChange={toggleAll} disabled={!queue.length} className="h-[18px] w-[18px] accent-[#2f261f]" />
                  Select all
                </label>
                <span className="text-[13px] text-[#6f6156] dark:text-[#b8a796]">Oldest first</span>
              </div>

              {queue.map((o) => {
                const on = selected.has(o.id);
                return (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer items-center gap-3.5 rounded-2xl bg-white px-4 py-3 transition-shadow dark:bg-[#1f1914] ${
                      on ? "shadow-[inset_0_0_0_1.5px_#2f261f] dark:shadow-[inset_0_0_0_1.5px_#c9ab8a]" : "shadow-[inset_0_0_0_1px_#ebe3da] dark:shadow-[inset_0_0_0_1px_#3a2f27]"
                    }`}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggle(o.id)} className="h-[18px] w-[18px] shrink-0 accent-[#2f261f]" />
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#efe6dc] text-sm font-bold text-[#6f5c49] dark:bg-[#3a2f27] dark:text-[#c9ab8a]">
                      {initials(o.to_name)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <b className="truncate text-[15px] font-semibold">{o.to_name}</b>
                      <span className="truncate text-[13px] text-[#6f6156] dark:text-[#b8a796]">
                        {o.order_number ? `${o.order_number} · ` : ""}
                        {o.carrier} {o.mail_class}
                      </span>
                    </span>
                    <span className="hidden flex-col items-end gap-0.5 sm:flex">
                      <span className="font-mono text-xs text-[#4a3d33] dark:text-[#d6c9bb]">…{String(o.tracking_number ?? "").slice(-6)}</span>
                      <span className="text-[12.5px] text-[#8a7b6d]">{shortDate(o.created_at)}</span>
                    </span>
                  </label>
                );
              })}

              {!queue.length && (
                <div className="rounded-2xl bg-white px-4 py-12 text-center text-[#8a7b6d] shadow-[inset_0_0_0_1px_#ebe3da] dark:bg-[#1f1914] dark:shadow-[inset_0_0_0_1px_#3a2f27]">
                  All caught up — no purchased labels waiting to print.
                </div>
              )}
            </div>
          ) : tab === "saved" ? (
            <div className="flex flex-col gap-2.5">
              {batches.map((b) => {
                const names: string[] = b.customer_names ?? [];
                const preview = names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3} more` : "");
                return (
                  <div key={b.id} className="flex flex-wrap items-center gap-3.5 rounded-2xl bg-white px-4 py-3 shadow-[inset_0_0_0_1px_#ebe3da] dark:bg-[#1f1914] dark:shadow-[inset_0_0_0_1px_#3a2f27]">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#efe6dc] text-[#6f5c49] dark:bg-[#3a2f27] dark:text-[#c9ab8a]">
                      <Icon d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <b className="text-[15px] font-semibold">
                        {b.label_count} label{b.label_count === 1 ? "" : "s"} · {shortDate(b.created_at)}
                        {b.reprint && <span className="ml-2 rounded-md bg-[#f1ebe4] px-1.5 py-0.5 text-[11px] font-semibold text-[#6f5c49] dark:bg-[#2e251e] dark:text-[#c9ab8a]">Reprint</span>}
                      </b>
                      <span className="truncate text-[13px] text-[#6f6156] dark:text-[#b8a796]">{preview || "—"}</span>
                    </span>
                    <div className="flex gap-1.5">
                      <button onClick={() => openBatch(b)} className="h-9 rounded-lg border border-[#e3d9ce] bg-white px-3 text-[13px] font-semibold hover:border-[#957f67] dark:border-[#3a2f27] dark:bg-transparent">
                        Open
                      </button>
                      <button onClick={() => printBatch(b)} disabled={busy !== null} className="h-9 rounded-lg border border-[#e3d9ce] bg-white px-3 text-[13px] font-semibold hover:border-[#957f67] disabled:opacity-50 dark:border-[#3a2f27] dark:bg-transparent">
                        {busy === b.id ? "…" : "Print"}
                      </button>
                      <button onClick={() => downloadBatch(b)} aria-label="Download PDF" title="Download" className="grid h-9 w-9 place-items-center rounded-lg border border-[#e3d9ce] bg-white text-[#6f5c49] hover:border-[#957f67] dark:border-[#3a2f27] dark:bg-transparent dark:text-[#c9ab8a]">
                        <Icon d="M12 3v12M7 10l5 5 5-5M5 21h14" size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {!batches.length && (
                <div className="rounded-2xl bg-white px-4 py-12 text-center text-[#8a7b6d] shadow-[inset_0_0_0_1px_#ebe3da] dark:bg-[#1f1914] dark:shadow-[inset_0_0_0_1px_#3a2f27]">
                  No saved PDFs yet. Every batch you print from now on will show up here.
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {history.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center gap-3.5 rounded-2xl bg-white px-4 py-3 shadow-[inset_0_0_0_1px_#ebe3da] dark:bg-[#1f1914] dark:shadow-[inset_0_0_0_1px_#3a2f27]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f1ebe4] text-sm font-bold text-[#8a7b6d] dark:bg-[#2e251e]">
                    {initials(o.to_name)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <b className="truncate text-[15px] font-semibold">{o.to_name}</b>
                    <span className="truncate text-[13px] text-[#6f6156] dark:text-[#b8a796]">
                      Printed {shortDate(o.printed_at)}
                      {o.printed_by ? ` · ${o.printed_by}` : ""}
                    </span>
                  </span>
                  <span className="hidden font-mono text-xs text-[#4a3d33] md:inline dark:text-[#d6c9bb]">{o.tracking_number}</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => printSelected([o.id], false, true)}
                      disabled={busy !== null}
                      className="h-9 rounded-lg border border-[#e3d9ce] bg-white px-3 text-[13px] font-semibold hover:border-[#957f67] disabled:opacity-50 dark:border-[#3a2f27] dark:bg-transparent"
                    >
                      Reprint
                    </button>
                    <button
                      onClick={() => markUnprinted(o)}
                      disabled={busy !== null}
                      className="h-9 rounded-lg border border-[#e3d9ce] bg-white px-3 text-[13px] text-[#6f6156] hover:border-[#957f67] disabled:opacity-50 dark:border-[#3a2f27] dark:bg-transparent dark:text-[#b8a796]"
                    >
                      {busy === o.id ? "…" : "Mark unprinted"}
                    </button>
                  </div>
                </div>
              ))}
              {!history.length && (
                <div className="rounded-2xl bg-white px-4 py-12 text-center text-[#8a7b6d] shadow-[inset_0_0_0_1px_#ebe3da] dark:bg-[#1f1914] dark:shadow-[inset_0_0_0_1px_#3a2f27]">
                  Nothing printed yet.
                </div>
              )}
            </div>
          )}
        </section>

        {tab === "queue" && (
          <aside
            aria-label="Print"
            className="flex w-full shrink-0 flex-col gap-[18px] self-start rounded-[22px] border border-[#ebe3da] bg-white p-[22px] lg:sticky lg:top-8 lg:w-[330px] dark:border-[#3a2f27] dark:bg-[#1f1914]"
          >
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6f6156] dark:text-[#b8a796]">
                {selected.size ? "Selected" : "Ready to print"}
              </span>
              <b className="text-[32px] font-semibold leading-none tracking-tight">
                {printCount} label{printCount === 1 ? "" : "s"}
              </b>
            </div>

            <div className="relative h-[210px] overflow-hidden rounded-2xl bg-[#f6f1eb] dark:bg-[#251e18]">
              {(picked.length ? picked : queue).slice(0, 4).map((o, i) => (
                <div
                  key={o.id}
                  className="absolute flex h-[156px] w-[104px] flex-col gap-1.5 rounded-md border border-[#e3d9ce] bg-white p-2 text-[#2f261f] shadow-[0_6px_16px_rgba(47,38,31,0.12)]"
                  style={{ top: 24 + i * 6, left: 70 + i * 34, transform: `rotate(${(i - 1) * 4}deg)` }}
                >
                  <div className="border-b-2 border-[#2f261f] pb-0.5 text-[7px] font-bold">{o.carrier || "USPS"}</div>
                  <span className="h-[3px] w-3/5 bg-[#ded5ca]" />
                  <b className="truncate text-[8px]">{o.to_name}</b>
                  <span className="flex-1" />
                  <span
                    className="h-[22px]"
                    style={{ background: "repeating-linear-gradient(90deg,#2f261f 0 2px,transparent 2px 4px,#2f261f 4px 5px,transparent 5px 7px)" }}
                  />
                </div>
              ))}
              {!queue.length && <div className="absolute inset-0 grid place-items-center text-sm text-[#8a7b6d]">Nothing to print</div>}
            </div>

            <div className="flex flex-col rounded-2xl border border-[#f1ebe4] text-sm dark:border-[#3a2f27]">
              <div className="flex items-center justify-between border-b border-[#f1ebe4] px-3.5 py-3 dark:border-[#3a2f27]">
                <span className="text-[#6f6156] dark:text-[#b8a796]">Label size</span>
                <b className="font-semibold">4×6</b>
              </div>
              <div className="flex items-center justify-between border-b border-[#f1ebe4] px-3.5 py-3 dark:border-[#3a2f27]">
                <span className="text-[#6f6156] dark:text-[#b8a796]">Branded logo</span>
                <b className="font-semibold">On</b>
              </div>
              <label className="flex cursor-pointer items-center justify-between px-3.5 py-3">
                <span className="text-[#6f6156] dark:text-[#b8a796]">Mark printed after</span>
                <input type="checkbox" checked={markAfter} onChange={(e) => setMarkAfter(e.target.checked)} className="h-[18px] w-[18px] accent-[#2f261f]" />
              </label>
            </div>

            <button
              onClick={() => printRef.current()}
              disabled={!queue.length || busy !== null}
              className="flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] bg-[#2f261f] text-base font-bold text-white transition-colors hover:bg-[#45382e] disabled:bg-[#ddd3c8] disabled:text-[#8a7b6d] dark:bg-[#c9ab8a] dark:text-[#2a211b]"
            >
              <Icon d={PRINT_ICON} width={2} />
              {busy === "print" ? "Merging…" : `Print ${printCount} label${printCount === 1 ? "" : "s"}`}
              <span className="ml-1 rounded-md bg-white/15 px-1.5 text-xs font-semibold dark:bg-black/10">P</span>
            </button>

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-[#8a7b6d]">
              <span className="flex items-center gap-1.5"><Kbd>P</Kbd> print</span>
              <span className="flex items-center gap-1.5"><Kbd>A</Kbd> select all</span>
              <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd> clear</span>
            </div>
          </aside>
        )}
      </div>
    </Shell>
  );
}
