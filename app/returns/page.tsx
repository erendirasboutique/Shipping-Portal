"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import BarcodeScanner from "@/components/BarcodeScanner";
import ReceiveReturn, { conditionLabel } from "@/components/ReceiveReturn";
import { supabaseBrowser } from "@/lib/supabase/client";

type RateOption = {
  id: string;
  carrier: string;
  service: string;
  rate: string | number;
  days?: number;
};

type Tab = "all" | "needsLabel" | "waiting" | "received" | "done";

const NUDGE_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

// Where a return is in its life, from the saved status.
function stageOf(rr: any): Tab {
  if (rr.status === "closed") return "done";
  if (rr.received_at || rr.status === "received") return "received";
  if (rr.status === "submitted") return "needsLabel";
  return "waiting";
}

const STAGE_LABEL: Record<Tab, string> = {
  all: "All",
  needsLabel: "Needs label",
  waiting: "Label sent",
  received: "Received",
  done: "Done",
};

const STAGE_PILL: Record<Tab, string> = {
  all: "",
  needsLabel: "bg-sand/50 text-ink",
  waiting: "bg-sand/30 text-taupe",
  received: "bg-taupe text-cream",
  done: "bg-ink/5 text-ink/50",
};

// Short tag for common reasons; the customer's own words show underneath.
function reasonTag(reason?: string | null): string | null {
  const r = (reason || "").toLowerCase();
  if (!r.trim()) return null;
  if (/small|pequeñ|chic/.test(r)) return "Too small";
  if (/big|large|grande/.test(r)) return "Too big";
  if (/damag|dañ|roto|broken|ripped|hole/.test(r)) return "Damaged";
  if (/wrong|equivoc|incorrect/.test(r)) return "Wrong item";
  if (/color|colour/.test(r)) return "Color";
  if (/fit|talla|size/.test(r)) return "Fit";
  return null;
}

function initials(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function shortDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// When the label was made (falls back to when the request came in).
function labelDate(rr: any): string | null {
  return rr.label_created_at || rr.updated_at || rr.created_at || null;
}

const I = {
  print: "M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z",
  scan: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M8 8v8M11 8v8M14 8v8M17 8v8",
  chevron: "M6 9l6 6 6-6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
};

function Icon({ d, size = 16, w = 1.8 }: { d: string; size?: number; w?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function ReturnsPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [requests, setRequests] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [instrOpen, setInstrOpen] = useState(false);
  const [showCodes, setShowCodes] = useState(false);

  // Rate selection modal state
  const [rateModal, setRateModal] = useState<{
    request: any;
    shipmentRef: string;
    rates: RateOption[];
  } | null>(null);
  const [buyingRateId, setBuyingRateId] = useState<string | null>(null);

  // Scan to receive
  const [scanning, setScanning] = useState(false);
  const [receiving, setReceiving] = useState<any | null>(null);

  const onScanReturn = useCallback(async (code: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/returns/receive?code=" + encodeURIComponent(code), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.request) return data.error || "No return matches that label.";
      setScanning(false);
      setReceiving(data.request);
      return null;
    } catch {
      return "Couldn't look that up. Check your connection and try again.";
    }
  }, []);

  async function load() {
    const [{ data: reqs }, { data: cds }] = await Promise.all([
      supabase.from("return_requests").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("return_codes").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setRequests(reqs ?? []);
    setCodes(cds ?? []);
    setLoaded(true);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the ··· menu and the instructions dropdown on any outside click or Escape.
  useEffect(() => {
    function close() {
      setMenuFor(null);
      setInstrOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  async function generateCode() {
    setBusy("code");
    const res = await fetch("/api/returns/codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return setMsg(data.error);
    setNewCode(data.code.code);
    load();
  }

  // Step 1: fetch rates across all carriers, then open the picker
  async function openRates(rr: any) {
    setBusy(rr.id);
    const res = await fetch("/api/returns/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: rr.id }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return setMsg(data.error);
    setRateModal({ request: rr, shipmentRef: data.shipment_ref, rates: data.rates });
  }

  // Step 2: buy the chosen rate
  async function buyRate(rate: RateOption) {
    if (!rateModal) return;
    setBuyingRateId(rate.id);
    const res = await fetch("/api/returns/label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: rateModal.request.id,
        rate_id: rate.id,
        shipment_ref: rateModal.shipmentRef,
        carrier: rate.carrier,
      }),
    });
    const data = await res.json();
    setBuyingRateId(null);
    if (!res.ok) return setMsg(data.error);
    setRateModal(null);
    setMsg(`${rate.carrier} return label created — ${data.tracking_number}`);
    load();
  }

  async function printLabel(rr: any) {
    if (!rr.label_url) return;
    setBusy(`print-${rr.id}`);
    try {
      const res = await fetch(rr.label_url);
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch {
      window.open(rr.label_url, "_blank"); // fallback if the label host blocks CORS
    }
    setBusy(null);
  }

  // Received → Done, once it's refunded, exchanged or restocked.
  async function setDone(rr: any, done: boolean) {
    setBusy(`done-${rr.id}`);
    const status = done ? "closed" : "received";
    const { error } = await supabase.from("return_requests").update({ status }).eq("id", rr.id);
    setBusy(null);
    if (error) return setMsg(error.message);
    setRequests((list) => list.map((x) => (x.id === rr.id ? { ...x, status } : x)));
    setMsg(done ? `Return from ${rr.from_name || "customer"} marked done.` : "Moved back to Received.");
  }

  function copy(text: string, what: string) {
    navigator.clipboard?.writeText(text).then(
      () => setMsg(`${what} copied.`),
      () => setMsg(`Couldn't copy the ${what.toLowerCase()}.`)
    );
  }

  /* ---------- Derived lists ---------- */

  const now = Date.now();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  const daysWaiting = (rr: any) => {
    const d = labelDate(rr);
    return d ? Math.max(0, Math.floor((now - new Date(d).getTime()) / DAY)) : 0;
  };

  const counts = useMemo(() => {
    const c = { all: requests.length, needsLabel: 0, waiting: 0, received: 0, done: 0, receivedMonth: 0, nudge: 0 };
    for (const rr of requests) {
      const s = stageOf(rr);
      c[s]++;
      if (rr.received_at && new Date(rr.received_at).getTime() >= monthStart) c.receivedMonth++;
      if (s === "waiting" && daysWaiting(rr) >= NUDGE_DAYS) c.nudge++;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests]);

  const shown = requests.filter((rr) => {
    if (tab !== "all" && stageOf(rr) !== tab) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [rr.from_name, rr.return_code, rr.tracking_number, rr.from_city, rr.reason].some((v) =>
      String(v || "").toLowerCase().includes(s)
    );
  });

  const tabs: [Tab, number][] = [
    ["all", counts.all],
    ["needsLabel", counts.needsLabel],
    ["waiting", counts.waiting],
    ["received", counts.received],
    ["done", counts.done],
  ];

  /* ---------- Pieces ---------- */

  function StatusCell({ rr }: { rr: any }) {
    const s = stageOf(rr);
    const days = daysWaiting(rr);
    const late = s === "waiting" && days >= NUDGE_DAYS;
    let sub: React.ReactNode = null;
    if (s === "waiting") sub = days === 0 ? "Sent today" : late ? `${days} days, not mailed yet` : `Sent ${days} day${days === 1 ? "" : "s"} ago`;
    if (s === "needsLabel") sub = `Asked ${shortDate(rr.created_at)}`;
    if ((s === "received" || s === "done") && rr.received_at) {
      sub = (
        <span className="inline-flex items-center gap-1.5">
          {rr.receive_photo_url && (
            <a href={rr.receive_photo_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={rr.receive_photo_url} alt="Returned item" className="h-6 w-6 rounded-md object-cover" />
            </a>
          )}
          {conditionLabel(rr.receive_condition)} · {shortDate(rr.received_at)}
        </span>
      );
    }
    return (
      <div className="flex flex-col items-start gap-1">
        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${STAGE_PILL[s]}`}>{STAGE_LABEL[s]}</span>
        {sub && <span className={`text-xs ${late ? "text-red-700" : "text-ink/55"}`}>{sub}</span>}
      </div>
    );
  }

  function ReasonCell({ reason }: { reason?: string | null }) {
    const tag = reasonTag(reason);
    if (!reason?.trim()) {
      return <span className="rounded-md border border-dashed border-sand px-2 py-0.5 text-xs text-ink/40">No reason</span>;
    }
    if (!tag) return <span className="line-clamp-2 text-sm">{reason}</span>;
    return (
      <div className="flex min-w-0 flex-col items-start gap-1">
        <span className="whitespace-nowrap rounded-md bg-sand/30 px-2 py-0.5 text-xs text-taupe">{tag}</span>
        <span className="max-w-full truncate text-xs italic text-ink/55">“{reason}”</span>
      </div>
    );
  }

  function PrimaryAction({ rr, full = false }: { rr: any; full?: boolean }) {
    const s = stageOf(rr);
    const cls = `inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm transition-colors disabled:opacity-50 ${full ? "flex-1" : ""}`;
    if (s === "needsLabel")
      return (
        <button onClick={() => openRates(rr)} disabled={busy !== null} className={`${cls} bg-taupe text-cream hover:bg-taupe/90`}>
          {busy === rr.id ? "Getting rates…" : "Create label"}
        </button>
      );
    if (s === "waiting")
      return (
        <button onClick={() => setReceiving(rr)} disabled={busy !== null} className={`${cls} bg-taupe text-cream hover:bg-taupe/90`}>
          Receive
        </button>
      );
    if (s === "received")
      return (
        <button onClick={() => setDone(rr, true)} disabled={busy !== null} className={`${cls} border border-sand text-taupe hover:border-taupe`}>
          {busy === `done-${rr.id}` ? "Saving…" : "Mark done"}
        </button>
      );
    return null;
  }

  function MoreMenu({ rr }: { rr: any }) {
    const open = menuFor === rr.id;
    const s = stageOf(rr);
    const item = "flex h-10 w-full items-center rounded-lg px-3 text-left text-sm text-ink hover:bg-sand/20 disabled:opacity-50";
    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuFor(open ? null : rr.id)}
          aria-label="More actions"
          aria-expanded={open}
          className="grid h-9 w-9 place-items-center rounded-full border border-sand text-taupe hover:border-taupe"
        >
          <Icon d={I.dots} w={2.6} />
        </button>
        {open && (
          <div role="menu" className="absolute right-0 top-11 z-20 w-56 rounded-2xl border border-sand/60 bg-cream p-1.5 shadow-xl">
            {rr.label_url && (
              <button role="menuitem" className={item} disabled={busy !== null} onClick={() => { setMenuFor(null); printLabel(rr); }}>
                {busy === `print-${rr.id}` ? "Opening…" : "Print return label"}
              </button>
            )}
            {rr.tracking_url && (
              <a role="menuitem" className={item} href={rr.tracking_url} target="_blank" rel="noreferrer" onClick={() => setMenuFor(null)}>
                Track package
              </a>
            )}
            {rr.tracking_number && (
              <button role="menuitem" className={item} onClick={() => { setMenuFor(null); copy(rr.tracking_number, "Tracking number"); }}>
                Copy tracking number
              </button>
            )}
            {rr.return_code && (
              <button role="menuitem" className={item} onClick={() => { setMenuFor(null); copy(rr.return_code, "Return code"); }}>
                Copy return code
              </button>
            )}
            {(s === "received" || s === "done") && (
              <button role="menuitem" className={item} onClick={() => { setMenuFor(null); setReceiving(rr); }}>
                Edit condition / photo
              </button>
            )}
            {s === "done" && (
              <button role="menuitem" className={item} onClick={() => { setMenuFor(null); setDone(rr, false); }}>
                Move back to Received
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ---------- Page ---------- */

  const btnSoft =
    "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-sand bg-white px-4 text-sm text-taupe transition-colors hover:border-taupe dark:bg-transparent";

  return (
    <Shell>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-3xl sm:text-4xl">Returns</h1>
        <div className="flex flex-wrap gap-2">
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setInstrOpen((o) => !o)} aria-expanded={instrOpen} className={btnSoft}>
              <Icon d={I.print} />
              Instructions
              <Icon d={I.chevron} size={13} w={2} />
            </button>
            {instrOpen && (
              <div role="menu" className="absolute left-0 top-12 z-20 w-48 rounded-2xl border border-sand/60 bg-cream p-1.5 shadow-xl">
                <a role="menuitem" href="/return-instructions-half.pdf" target="_blank" rel="noreferrer" onClick={() => setInstrOpen(false)}
                  className="flex h-10 items-center rounded-lg px-3 text-sm hover:bg-sand/20">Half page</a>
                <a role="menuitem" href="/return-instructions-full.pdf" target="_blank" rel="noreferrer" onClick={() => setInstrOpen(false)}
                  className="flex h-10 items-center rounded-lg px-3 text-sm hover:bg-sand/20">Full page</a>
              </div>
            )}
          </div>
          <button onClick={() => setScanning(true)} className={btnSoft}>
            <Icon d={I.scan} />
            Scan return
          </button>
          <button onClick={generateCode} disabled={busy === "code"}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-taupe px-5 text-sm text-cream transition-colors hover:bg-taupe/90 disabled:opacity-50">
            <Icon d={I.plus} w={2.2} />
            {busy === "code" ? "Generating…" : "Return code"}
          </button>
        </div>
      </div>

      {msg && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-sand/70 bg-sand/25 px-4 py-3 text-sm text-taupe">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} aria-label="Dismiss" className="shrink-0 rounded-md p-0.5 hover:bg-sand/50"><Icon d={I.close} /></button>
        </div>
      )}

      {newCode && (
        <div className="card mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="label">New return access code</p>
            <p className="break-all font-mono text-xl tracking-widest text-taupe sm:text-2xl">{newCode}</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => copy(newCode, "Code")}>Copy code</button>
            <button className="btn-secondary" onClick={() => setNewCode(null)} aria-label="Hide new code">Done</button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Needs a label", value: counts.needsLabel, note: "Request came in", go: "needsLabel" as Tab },
          { label: "Waiting on customer", value: counts.waiting, note: "Label sent, not back yet", go: "waiting" as Tab },
          { label: "Received this month", value: counts.receivedMonth, note: "Back at the boutique", go: "received" as Tab },
          { label: "Needs a nudge", value: counts.nudge, note: `Label over ${NUDGE_DAYS} days old`, go: "waiting" as Tab },
        ].map((s) => (
          <button key={s.label} onClick={() => setTab(s.go)}
            className="flex flex-col items-start gap-0.5 rounded-2xl border border-sand/60 bg-white px-4 py-3.5 text-left transition-colors hover:border-taupe/60 dark:bg-transparent">
            <span className="text-sm text-ink/60">{s.label}</span>
            <span className="font-heading text-3xl leading-tight text-taupe">{loaded ? s.value : "–"}</span>
            <span className={`text-xs ${s.label === "Needs a nudge" && s.value > 0 ? "text-red-700" : "text-ink/50"}`}>{s.note}</span>
          </button>
        ))}
      </div>

      {/* Tabs + search */}
      <div className="mt-6 flex flex-col gap-3 border-b border-sand/60 md:flex-row md:items-end md:justify-between">
        <div role="tablist" className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map(([key, n]) => {
            const on = tab === key;
            return (
              <button key={key} role="tab" aria-selected={on} onClick={() => setTab(key)}
                className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 text-[15px] transition-colors ${
                  on ? "border-taupe text-ink" : "border-transparent text-ink/55 hover:text-ink"
                }`}>
                {STAGE_LABEL[key]}
                <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${on ? "bg-taupe text-cream" : "bg-sand/30 text-taupe"}`}>{n}</span>
              </button>
            );
          })}
        </div>
        <label className="mb-2 flex h-10 w-full items-center gap-2 rounded-full border border-sand bg-white px-3.5 text-taupe md:w-72 dark:bg-transparent">
          <Icon d={I.search} size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code or tracking" aria-label="Search returns"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/40" />
          {q && <button onClick={() => setQ("")} aria-label="Clear search" className="text-ink/40 hover:text-ink"><Icon d={I.close} size={14} /></button>}
        </label>
      </div>

      {/* Mobile: cards */}
      <div className="mt-4 space-y-3 md:hidden">
        {shown.map((rr) => (
          <div key={rr.id} className="card space-y-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand/30 text-sm text-taupe">{initials(rr.from_name)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{rr.from_name || "—"}</p>
                <p className="text-xs text-ink/60">
                  {[rr.from_city, rr.from_state].filter(Boolean).join(", ")}
                  {rr.return_code ? ` · ${rr.return_code}` : ""}
                </p>
              </div>
              <StatusCell rr={rr} />
            </div>
            {rr.reason?.trim() && <ReasonCell reason={rr.reason} />}
            <div className="flex items-center gap-2">
              <PrimaryAction rr={rr} full />
              <MoreMenu rr={rr} />
            </div>
          </div>
        ))}
        {loaded && !shown.length && <div className="card py-10 text-center text-ink/50">{q || tab !== "all" ? "No returns match." : "No return requests yet."}</div>}
      </div>

      {/* Desktop: table */}
      <div className="card mt-4 hidden !overflow-visible !p-0 md:block">
        <table className="w-full">
          <thead className="border-b border-sand/60">
            <tr>
              <th className="table-th">Customer</th>
              <th className="table-th">Code</th>
              <th className="table-th">Reason</th>
              <th className="table-th">Status</th>
              <th className="table-th">Tracking</th>
              <th className="table-th w-[170px]" />
            </tr>
          </thead>
          <tbody>
            {shown.map((rr) => (
              <tr key={rr.id} className="border-b border-sand/30 transition-colors last:border-0 hover:bg-sand/10">
                <td className="table-td">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand/30 text-sm text-taupe">{initials(rr.from_name)}</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{rr.from_name || "—"}</p>
                      <p className="truncate text-xs text-ink/60">{[rr.from_city, rr.from_state].filter(Boolean).join(", ")}</p>
                    </div>
                  </div>
                </td>
                <td className="table-td whitespace-nowrap font-mono text-xs">{rr.return_code || "—"}</td>
                <td className="table-td max-w-[220px]"><ReasonCell reason={rr.reason} /></td>
                <td className="table-td"><StatusCell rr={rr} /></td>
                <td className="table-td">
                  {rr.tracking_number ? (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-xs text-ink/60">
                      …{String(rr.tracking_number).slice(-6)}
                      <button onClick={() => copy(rr.tracking_number, "Tracking number")} aria-label="Copy tracking number"
                        className="grid h-7 w-7 place-items-center rounded-md text-taupe hover:bg-sand/30">
                        <Icon d={I.copy} size={14} />
                      </button>
                    </span>
                  ) : (
                    <span className="text-ink/30">—</span>
                  )}
                </td>
                <td className="table-td">
                  <div className="flex items-center justify-end gap-1.5">
                    <PrimaryAction rr={rr} />
                    <MoreMenu rr={rr} />
                  </div>
                </td>
              </tr>
            ))}
            {loaded && !shown.length && (
              <tr><td colSpan={6} className="table-td py-10 text-center text-ink/50">{q || tab !== "all" ? "No returns match." : "No return requests yet."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Access codes (tucked away) */}
      <div className="mt-8">
        <button onClick={() => setShowCodes((v) => !v)} aria-expanded={showCodes}
          className="flex items-center gap-2 text-lg text-taupe">
          <span className={`transition-transform ${showCodes ? "" : "-rotate-90"}`}><Icon d={I.chevron} size={16} w={2} /></span>
          Recent access codes
          <span className="rounded-full bg-sand/30 px-2 py-0.5 text-xs">{codes.filter((c) => !c.used).length} active</span>
        </button>
        {showCodes && (
          <div className="card mt-3 overflow-x-auto !p-0">
            <table className="w-full min-w-[480px]">
              <thead className="border-b border-sand/60">
                <tr>
                  <th className="table-th">Code</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Created</th>
                  <th className="table-th">By</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-b border-sand/30 last:border-0">
                    <td className="table-td font-mono">
                      <span className="inline-flex items-center gap-1">
                        {c.code}
                        <button onClick={() => copy(c.code, "Code")} aria-label="Copy code" className="grid h-7 w-7 place-items-center rounded-md text-taupe hover:bg-sand/30">
                          <Icon d={I.copy} size={14} />
                        </button>
                      </span>
                    </td>
                    <td className="table-td">
                      <span className={`rounded-full px-2.5 py-1 text-xs ${c.used ? "bg-ink/5 text-ink/50" : "bg-taupe text-cream"}`}>{c.used ? "Used" : "Active"}</span>
                    </td>
                    <td className="table-td text-ink/60">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="table-td text-ink/60">{c.created_by || "—"}</td>
                  </tr>
                ))}
                {!codes.length && (
                  <tr><td colSpan={4} className="table-td py-8 text-center text-ink/50">No codes generated yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {scanning && (
        <BarcodeScanner title="Scan a return" onCode={onScanReturn} onClose={() => setScanning(false)} />
      )}

      {receiving && (
        <ReceiveReturn
          request={receiving}
          onClose={() => setReceiving(null)}
          onSaved={(updated) => {
            setRequests((list) => list.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
            setReceiving(null);
            setMsg(`Return from ${updated.from_name || "customer"} marked received (${conditionLabel(updated.receive_condition)}).`);
          }}
        />
      )}

      {/* Rate selection modal */}
      {rateModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
          onClick={() => buyingRateId === null && setRateModal(null)}
        >
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-cream p-5 sm:max-w-md sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl">Choose a return rate</h3>
                <p className="mt-1 text-sm text-ink/60">
                  {rateModal.request.from_name || "Customer"}
                  {rateModal.request.from_city ? ` · ${rateModal.request.from_city}, ${rateModal.request.from_state}` : ""}
                </p>
              </div>
              <button
                className="btn-secondary !px-3 !py-1.5 !text-xs"
                onClick={() => setRateModal(null)}
                disabled={buyingRateId !== null}
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {rateModal.rates.map((rate) => (
                <button
                  key={rate.id}
                  onClick={() => buyRate(rate)}
                  disabled={buyingRateId !== null}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-sand/60 bg-white/60 px-4 py-3 text-left transition hover:border-taupe disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {rate.carrier} <span className="text-ink/70">· {rate.service}</span>
                    </p>
                    {rate.days != null && (
                      <p className="text-xs text-ink/60">~{rate.days} day{rate.days === 1 ? "" : "s"}</p>
                    )}
                  </div>
                  <p className="shrink-0 font-mono text-taupe">
                    {buyingRateId === rate.id ? "Buying…" : `$${Number(rate.rate).toFixed(2)}`}
                  </p>
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs text-ink/50">
              Tap a rate to purchase the label. Scan-based rates only bill when the label is used.
            </p>
          </div>
        </div>
      )}
    </Shell>
  );
}
