"use client";

// Scan a Label — scan any shipping label to reprint it, void it, or log
// that the package came back (returned to sender) and send it again.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import BarcodeScanner from "@/components/BarcodeScanner";
import ChangeLabel from "@/components/ChangeLabel";

type Order = {
  id: string;
  order_number: number | null;
  customer_id: string | null;
  to_name: string | null;
  to_street1: string | null;
  to_street2: string | null;
  to_city: string | null;
  to_state: string | null;
  to_zip: string | null;
  carrier: string | null;
  mail_class: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  postage_amount: number | null;
  status: string | null;
  refund_status: string | null;
  label_url: string | null;
  printed_at: string | null;
  printed_by: string | null;
  packed_at: string | null;
  customer_notified_at: string | null;
  created_at: string;
  rts_at: string | null;
  rts_by: string | null;
  rts_reason: string | null;
  reshipped_to: string | null;
  reship_label: string | null;
  provider: string | null;
  insurance_amount: number | null;
  label_history: any[] | null;
  customer_notes: string | null;
  notes: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  weight_lb: number | string | null;
  weight_oz: number | string | null;
};

const RTS_REASONS = ["Bad address", "Unclaimed", "Refused", "Damaged in transit", "Other"];

function label(o: Order) {
  return o.order_number != null ? "EB-" + o.order_number : "Order";
}
function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}
function day(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}
function firstName(n: string | null) {
  const f = (n || "").trim().split(/\s+/)[0] || "";
  return f ? f.charAt(0).toUpperCase() + f.slice(1).toLowerCase() : "";
}
// "paty mondragon" → "Paty Mondragon" (display only; the saved name is unchanged)
function properName(n: string | null) {
  const s = (n || "").trim();
  if (!s) return "Customer";
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => w.split("-").map((x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x)).join("-"))
    .join(" ");
}
function initials(n: string | null) {
  const p = (n || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

const I = {
  scan: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M8 8v8M11 8v8M14 8v8M17 8v8",
  print: "M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z",
  change: "M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4",
  back: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  x: "M6 6l12 12M18 6 6 18",
  doc: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3",
  chevron: "M9 6l6 6-6 6",
};

function Icon({ d, size = 20, w = 1.7, className = "" }: { d: string; size?: number; w?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={d} />
    </svg>
  );
}

export default function LabelToolsPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [typed, setTyped] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [rtsOpen, setRtsOpen] = useState(false);
  const [rtsReason, setRtsReason] = useState("");
  const [rtsNote, setRtsNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [trackCopied, setTrackCopied] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [histOpen, setHistOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const find = useCallback(async (code: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/label-tools?code=" + encodeURIComponent(code), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) return data.error || "No order matches that label.";
      setOrder(data.order);
      setScanning(false);
      setTyped("");
      setMsg(null);
      setRtsOpen(false);
      setRtsReason("");
      setRtsNote("");
      setCopied(false);
      setTrackCopied(false);
      setChangeOpen(false);
      setNoteText("");
      setHistOpen(false);
      setNoteOpen(false);
      return null;
    } catch {
      return "Couldn't look that up. Check your connection and try again.";
    }
  }, []);

  async function typedSearch() {
    if (!typed.trim()) return;
    setBusy("find");
    const err = await find(typed);
    setBusy(null);
    if (err) setMsg({ kind: "err", text: err });
  }

  function clear() {
    setOrder(null);
    setMsg(null);
    setRtsOpen(false);
    setChangeOpen(false);
  }

  async function reprint() {
    if (!order) return;
    setBusy("print");
    setMsg(null);
    try {
      const res = await fetch("/api/batch/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_ids: [order.id], mark_printed: true }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Couldn't make the label.");
      }
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
      setOrder({ ...order, printed_at: new Date().toISOString() });
      setMsg({ kind: "ok", text: "Label opened. Print it from the new tab." });
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
    }
    setBusy(null);
  }

  async function voidLabel() {
    if (!order) return;
    const warn = order.packed_at || order.customer_notified_at
      ? "\n\nThis package was already packed" + (order.customer_notified_at ? " and the customer was told it's on the way" : "") + "."
      : "";
    if (!confirm("Void the " + (order.carrier || "") + " label for " + (order.to_name || "this customer") + " and ask for a refund?" + warn)) return;
    setBusy("void");
    setMsg(null);
    try {
      const res = await fetch("/api/labels/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "The carrier didn't accept the refund.");
      setOrder({ ...order, status: "refunded", refund_status: d.refund_status || "submitted" });
      setMsg({ kind: "ok", text: "Label voided. Refund requested from the carrier (" + (d.refund_status || "submitted") + ")." });
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
    }
    setBusy(null);
  }

  async function post(body: any) {
    const res = await fetch("/api/label-tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Something went wrong.");
    return d;
  }

  async function saveRts() {
    if (!order) return;
    if (!rtsReason) {
      setMsg({ kind: "err", text: "Pick why it came back." });
      return;
    }
    setBusy("rts");
    setMsg(null);
    try {
      const d = await post({ action: "rts", orderId: order.id, reason: rtsReason, note: rtsNote });
      setOrder(d.order);
      setRtsOpen(false);
      setMsg({ kind: "ok", text: "Marked as returned to sender." });
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
    }
    setBusy(null);
  }

  async function undoRts() {
    if (!order) return;
    setBusy("undo");
    try {
      const d = await post({ action: "undo_rts", orderId: order.id });
      setOrder(d.order);
      setMsg(null);
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
    }
    setBusy(null);
  }

  async function reship() {
    if (!order) return;
    setBusy("reship");
    try {
      const d = await post({ action: "reship", orderId: order.id });
      router.push("/create-label?draft=" + d.draftId);
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
      setBusy(null);
    }
  }

  async function saveNote() {
    if (!order || !noteText.trim()) return;
    setBusy("note");
    try {
      const d = await post({ action: "note", orderId: order.id, note: noteText });
      setOrder(d.order);
      setNoteText("");
      setMsg({
        kind: "ok",
        text: d.savedToCustomer ? "Note saved to the customer's profile and this order." : "Note saved to this order (no customer profile is linked).",
      });
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
    }
    setBusy(null);
  }

  function customerMessage(o: Order) {
    const hi = firstName(o.to_name);
    const addr = [o.to_street1, o.to_street2, [o.to_city, o.to_state].filter(Boolean).join(", ") + " " + (o.to_zip || "")]
      .filter((x) => x && String(x).trim())
      .join(", ");
    return (
      "¡Hola" + (hi ? " " + hi : "") + "! Tu paquete (" + label(o) + ") nos fue devuelto por el correo. " +
      "¿Nos confirmas tu dirección? La que tenemos es: " + addr + ". En cuanto nos confirmes, te lo volvemos a enviar. 🧡" +
      "\n\nHi" + (hi ? " " + hi : "") + "! Your package (" + label(o) + ") was returned to us by the carrier. " +
      "Can you confirm your address? We have: " + addr + ". As soon as you confirm, we'll send it again."
    );
  }

  function copyMessage() {
    if (!order) return;
    navigator.clipboard?.writeText(customerMessage(order)).then(() => setCopied(true), () => setCopied(false));
  }

  function copyTracking() {
    if (!order?.tracking_number) return;
    navigator.clipboard?.writeText(order.tracking_number).then(
      () => {
        setTrackCopied(true);
        setTimeout(() => setTrackCopied(false), 1800);
      },
      () => {}
    );
  }

  // Bring the opened form (change / came back) into view, mainly for phones.
  function reveal() {
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const refunded = order ? order.status === "refunded" || !!order.refund_status : false;

  // P reprints the found label (desktop keyboards); Esc clears.
  const reprintRef = useRef(reprint);
  reprintRef.current = reprint;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!order || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.key.toLowerCase() === "p" && !busy && !refunded) {
        e.preventDefault();
        reprintRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order, busy, refunded]);

  // Everything that happened to this label, newest first.
  const history: { what: string; at: string }[] = [];
  if (order) {
    history.push({ what: "Bought" + (order.postage_amount != null ? " · $" + Number(order.postage_amount).toFixed(2) : ""), at: order.created_at });
    if (order.printed_at) history.push({ what: "Printed" + (order.printed_by ? " · " + order.printed_by.split("@")[0] : ""), at: order.printed_at });
    if (order.packed_at) history.push({ what: "Packed", at: order.packed_at });
    if (order.customer_notified_at) history.push({ what: "Customer told it's on the way", at: order.customer_notified_at });
    if (order.rts_at) history.push({ what: "Came back" + (order.rts_reason ? " · " + order.rts_reason : ""), at: order.rts_at });
    (order.label_history || []).forEach((h: any) => {
      if (h?.replaced_at)
        history.push({
          what: "Label replaced" + (h.reason ? " · " + h.reason : "") + (h.refund_status ? " · refund " + h.refund_status : ""),
          at: h.replaced_at,
        });
    });
    history.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }

  // Status badge for the customer card.
  let statusBadge: { text: string; cls: string } | null = null;
  if (order) {
    if (refunded) statusBadge = { text: "Voided · " + (order.refund_status || "refunded"), cls: "bg-red-50 text-red-700" };
    else if (order.rts_at) statusBadge = { text: "Came back " + day(order.rts_at), cls: "bg-[#fbf1dc] text-[#7a5a1e]" };
    else if (order.packed_at) statusBadge = { text: "Packed " + day(order.packed_at), cls: "bg-taupe text-cream" };
    else if (order.printed_at) statusBadge = { text: "Printed " + day(order.printed_at), cls: "bg-taupe text-cream" };
    else statusBadge = { text: "Not printed yet", cls: "border border-dashed border-sand text-ink/60" };
  }

  const tile =
    "flex h-[116px] flex-col items-start justify-between rounded-[20px] border border-sand bg-white p-4 text-left transition-colors hover:border-taupe disabled:cursor-not-allowed disabled:opacity-50 lg:h-[170px] lg:rounded-3xl lg:p-5 dark:bg-transparent";
  const tileTitle = "text-base text-ink lg:text-[19px]";
  const tileSub = "text-xs text-ink/55 lg:text-[13px]";

  const msgBox = msg && (
    <p
      role={msg.kind === "err" ? "alert" : "status"}
      onClick={() => setMsg(null)}
      className={`cursor-pointer rounded-2xl px-4 py-3 text-sm ${
        msg.kind === "ok" ? "bg-sand/30 text-taupe" : "bg-red-50 text-red-700"
      }`}
    >
      {msg.text}
    </p>
  );

  return (
    <Shell>
      <div className={`flex flex-col gap-4 lg:gap-5 ${order && !refunded ? "pb-28 lg:pb-0" : ""}`}>
        {/* ---------- Start: nothing found yet ---------- */}
        {!order && (
          <>
            <div className="card !rounded-[2rem] !p-5 md:!p-8">
              <p className="eyebrow">Fix a label</p>
              <h1 className="mt-1 text-4xl md:text-5xl">Scan a Label</h1>
              <p className="mt-2 text-sm text-ink/70">Reprint a smudged label, void a mistake, or log a package that came back.</p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button onClick={() => setScanning(true)} className="btn-primary inline-flex items-center justify-center gap-2 !px-6 !py-3.5 !text-base">
                  <Icon d={I.scan} size={18} w={1.8} />
                  Scan label
                </button>
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    typedSearch();
                  }}
                >
                  <input
                    className="input"
                    placeholder="Or type tracking or EB-123"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoCapitalize="characters"
                    enterKeyHint="search"
                  />
                  <button type="submit" disabled={!typed.trim() || !!busy} className="btn-secondary shrink-0">
                    {busy === "find" ? "…" : "Find"}
                  </button>
                </form>
              </div>
              {msg && <div className="mt-4">{msgBox}</div>}
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { d: I.print, t: "Reprint", s: "Smudged or lost label. Free." },
                { d: I.change, t: "Change & rebuy", s: "Wrong weight, box or service." },
                { d: I.back, t: "Came back", s: "Returned to sender. Log it and reship." },
                { d: I.x, t: "Void & refund", s: "Only before the post office scans it." },
              ].map((x) => (
                <div key={x.t} className="flex gap-3 rounded-[20px] border border-sand/60 bg-white p-4 dark:bg-transparent">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand/30 text-taupe"><Icon d={x.d} size={18} w={1.8} /></span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] text-ink">{x.t}</span>
                    <span className="text-xs text-ink/55">{x.s}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ---------- Found ---------- */}
        {order && (
          <>
            {/* Top bar */}
            <div className="flex items-center gap-3">
              <button onClick={clear} aria-label="Clear and start over"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-sand bg-white text-taupe hover:border-taupe lg:hidden dark:bg-transparent">
                <Icon d={I.x} size={18} w={2} />
              </button>
              <h1 className="flex-1 text-center text-2xl lg:text-left lg:text-4xl">Scan a Label</h1>
              <form
                className="hidden w-80 items-center gap-2 lg:flex"
                onSubmit={(e) => {
                  e.preventDefault();
                  typedSearch();
                }}
              >
                <label className="flex h-11 flex-1 items-center gap-2 rounded-full border border-sand bg-white px-4 text-taupe dark:bg-transparent">
                  <Icon d={I.search} size={15} w={1.8} />
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Find another label" aria-label="Find another label"
                    className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/40" />
                </label>
              </form>
              <button onClick={clear} className="btn-secondary hidden lg:inline-flex">✕ Clear</button>
              <button onClick={() => setScanning(true)} aria-label="Scan next label"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-taupe text-cream lg:h-auto lg:w-auto lg:rounded-full lg:px-5 lg:py-3">
                <span className="lg:hidden"><Icon d={I.scan} size={19} w={1.8} /></span>
                <span className="hidden text-[15px] lg:inline">Scan next</span>
              </button>
            </div>

            {msgBox}

            {/* Customer */}
            <section className="card !rounded-3xl !p-4 lg:!rounded-[2rem] lg:!p-7">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
                <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-5">
                  <span className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full bg-sand/30 text-[17px] text-taupe lg:h-16 lg:w-16 lg:text-[22px]">
                    {initials(order.to_name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs tracking-[0.12em] text-taupe">
                      {label(order)}
                      <span className="hidden lg:inline">{order.mail_class ? " · " + [order.carrier, order.mail_class].filter(Boolean).join(" ").toUpperCase() : ""}</span>
                    </p>
                    <p className="truncate font-heading text-[26px] leading-tight text-taupe lg:text-4xl">{properName(order.to_name)}</p>
                    <p className="truncate text-sm text-ink/60">
                      <span className="hidden lg:inline">{[order.to_street1, order.to_street2].filter(Boolean).join(", ")}{order.to_street1 ? ", " : ""}</span>
                      {[order.to_city, order.to_state].filter(Boolean).join(", ")} {order.to_zip}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
                  {statusBadge && <span className={`rounded-full px-3 py-1 text-[13px] ${statusBadge.cls}`}>{statusBadge.text}</span>}
                  <span className="rounded-full bg-sand/30 px-3 py-1 text-[13px] text-taupe lg:hidden">
                    {[order.carrier, order.mail_class].filter(Boolean).join(" ") || "Label"}
                  </span>
                  {!!order.insurance_amount && (
                    <span className="rounded-full bg-sand/30 px-3 py-1 text-[13px] text-taupe">Insured ${Number(order.insurance_amount).toFixed(0)}</span>
                  )}
                  <Link href={"/orders/" + order.id} className="hidden text-sm text-taupe hover:underline lg:inline">Open order →</Link>
                </div>
              </div>

              {order.tracking_number && (
                <button onClick={copyTracking}
                  className="mt-3 flex min-h-[44px] w-full items-center gap-3 rounded-xl bg-cream px-3.5 text-left lg:mt-5 dark:bg-transparent dark:ring-1 dark:ring-sand/40">
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink/70">
                    <span className="lg:hidden">…{order.tracking_number.slice(-12)}</span>
                    <span className="hidden lg:inline">{order.tracking_number}</span>
                  </span>
                  <span className="shrink-0 text-[13.5px] text-taupe">{trackCopied ? "Copied ✓" : "Copy tracking"}</span>
                </button>
              )}
            </section>

            {/* Action tiles */}
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3.5">
              <button onClick={reprint} disabled={!!busy || refunded}
                className={`${tile} hidden !border-taupe !bg-taupe lg:flex`}>
                <Icon d={I.print} size={26} className="text-cream" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[19px] text-cream">{busy === "print" ? "Opening…" : "Reprint"}</span>
                  <span className="text-[13px] text-cream/85">Same label, no charge · press P</span>
                </span>
              </button>

              <button onClick={() => { setChangeOpen(true); setRtsOpen(false); reveal(); }} disabled={!!busy || refunded || changeOpen} className={tile}>
                <Icon d={I.change} size={24} className="text-taupe" />
                <span className="flex flex-col gap-0.5">
                  <span className={tileTitle}>Change &amp; rebuy</span>
                  <span className={tileSub}>Service, weight, insurance</span>
                </span>
              </button>

              <button onClick={() => { setRtsOpen(true); setChangeOpen(false); reveal(); }} disabled={!!busy || !!order.rts_at || rtsOpen} className={tile}>
                <Icon d={I.back} size={24} className="text-taupe" />
                <span className="flex flex-col gap-0.5">
                  <span className={tileTitle}>Came back</span>
                  <span className={tileSub}>{order.rts_at ? "Logged " + day(order.rts_at) : "Returned to sender"}</span>
                </span>
              </button>

              <Link href={"/orders/" + order.id} className={`${tile} lg:hidden`}>
                <Icon d={I.doc} size={24} className="text-taupe" />
                <span className="flex flex-col gap-0.5">
                  <span className={tileTitle}>Open order</span>
                  <span className={tileSub}>Full details</span>
                </span>
              </Link>

              <button onClick={voidLabel} disabled={!!busy || refunded}
                className={`${tile} ${refunded ? "border-dashed" : "hover:!border-red-300"}`}>
                <Icon d={I.x} size={24} className={refunded ? "text-ink/30" : "text-red-700"} />
                <span className="flex flex-col gap-0.5">
                  <span className={`${tileTitle} !text-red-700`}>{busy === "void" ? "Voiding…" : "Void & refund"}</span>
                  <span className={tileSub}>{refunded ? "Already voided" : "Only before USPS scans it"}</span>
                </span>
              </button>
            </div>

            {/* Opened panels */}
            <div ref={panelRef} className="scroll-mt-4">
              {changeOpen && !refunded && (
                <section className="card !rounded-3xl !p-5 lg:!p-6">
                  <ChangeLabel
                    order={order}
                    onCancel={() => setChangeOpen(false)}
                    onDone={(updated, oldRefund) => {
                      setOrder(updated);
                      setChangeOpen(false);
                      const failed = String(oldRefund || "").startsWith("failed");
                      setMsg({
                        kind: failed ? "err" : "ok",
                        text:
                          "New label bought: " +
                          [updated.carrier, updated.mail_class].filter(Boolean).join(" ") +
                          " · " +
                          updated.tracking_number +
                          ". Tap Reprint label to print it. " +
                          (failed
                            ? "The old label couldn't be voided automatically (" + oldRefund + "). Void it from the carrier's site."
                            : "Old label voided (refund " + oldRefund + ").") +
                          (updated.customer_notified_at ? " The customer already got the old tracking link, so send them the new one." : ""),
                      });
                    }}
                  />
                </section>
              )}

              {rtsOpen && !order.rts_at && (
                <section className="card !rounded-3xl !p-5 lg:!p-6">
                  <p className="label">Why did it come back?</p>
                  <div className="flex flex-wrap gap-2">
                    {RTS_REASONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRtsReason(r)}
                        className={`min-h-[40px] rounded-full border px-4 text-sm ${
                          rtsReason === r ? "border-taupe bg-taupe text-cream" : "border-sand text-taupe hover:border-taupe"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <input
                    className="input mt-3"
                    placeholder="Note (optional): e.g. 'Attempted, no such number'"
                    value={rtsNote}
                    onChange={(e) => setRtsNote(e.target.value)}
                  />
                  <div className="mt-3 flex gap-2">
                    <button onClick={saveRts} disabled={!!busy} className="btn-primary flex-1">
                      {busy === "rts" ? "Saving…" : "Mark returned"}
                    </button>
                    <button onClick={() => setRtsOpen(false)} className="btn-secondary">Cancel</button>
                  </div>
                </section>
              )}

              {order.rts_at && (
                <section className="rounded-3xl border border-[#e6c88f]/60 bg-[#fdf8ee] p-5 lg:p-6 dark:bg-transparent">
                  <p className="text-[15px] text-ink">Returned to sender{order.rts_reason ? ": " + order.rts_reason : ""}</p>
                  <p className="mt-0.5 text-xs text-ink/60">
                    Logged {when(order.rts_at)}
                    {order.rts_by ? " by " + order.rts_by.split("@")[0] : ""}
                  </p>
                  <ol className="mt-4 grid gap-4 text-sm lg:grid-cols-2">
                    <li className="flex flex-col gap-2">
                      <p className="text-ink">1. Ask the customer to confirm their address</p>
                      <button onClick={copyMessage} className="btn-secondary self-start !py-2 text-xs">
                        {copied ? "Message copied ✓" : "Copy message (ES + EN)"}
                      </button>
                    </li>
                    <li className="flex flex-col gap-2">
                      <p className="text-ink">2. Send it again</p>
                      {order.reshipped_to ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-ink/60">Re-ship started: {order.reship_label || "new order"}</span>
                          <Link href={"/create-label?draft=" + order.reshipped_to} className="btn-secondary !py-2 text-xs">Open it</Link>
                        </div>
                      ) : (
                        <button onClick={reship} disabled={!!busy} className="btn-primary self-start !py-2 text-xs">
                          {busy === "reship" ? "Setting up…" : "Fix address & re-ship"}
                        </button>
                      )}
                      <p className="text-xs text-ink/50">Opens Create Label with the same customer and package filled in.</p>
                    </li>
                  </ol>
                  <button onClick={undoRts} disabled={!!busy} className="mt-4 text-xs text-taupe underline underline-offset-2">
                    Marked by mistake? Undo
                  </button>
                </section>
              )}
            </div>

            {/* History + note: folded rows on phones, two cards on desktop */}
            <div className="overflow-hidden rounded-[20px] border border-sand/60 bg-white lg:grid lg:grid-cols-2 lg:gap-3.5 lg:overflow-visible lg:border-0 lg:bg-transparent dark:bg-transparent">
              <section className="lg:rounded-3xl lg:border lg:border-sand/60 lg:bg-white lg:p-5 dark:lg:bg-transparent">
                <button onClick={() => setHistOpen((v) => !v)} aria-expanded={histOpen}
                  className="flex h-[54px] w-full items-center justify-between px-4 text-left lg:pointer-events-none lg:h-auto lg:px-0 lg:pb-2">
                  <span className="text-[15.5px] text-ink lg:text-xs lg:uppercase lg:tracking-[0.14em] lg:text-taupe">History</span>
                  <span className="flex items-center gap-1 text-[13.5px] text-ink/55 lg:hidden">
                    {history.length} event{history.length === 1 ? "" : "s"}
                    <Icon d={I.chevron} size={15} w={2} className={`transition-transform ${histOpen ? "rotate-90" : ""}`} />
                  </span>
                </button>
                <div className={`${histOpen ? "block" : "hidden"} px-4 pb-3 lg:block lg:px-0 lg:pb-0`}>
                  {history.map((h, i) => (
                    <div key={i} className="flex justify-between gap-3 border-b border-sand/30 py-2 text-sm last:border-0">
                      <span className="text-ink">{h.what}</span>
                      <span className="shrink-0 text-ink/55">{when(h.at)}</span>
                    </div>
                  ))}
                  {Array.isArray(order.label_history) && order.label_history.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs uppercase tracking-[0.14em] text-taupe">Replaced labels</p>
                      {order.label_history.slice().reverse().map((h: any, i: number) => (
                        <div key={i} className="rounded-xl border border-sand/50 px-3 py-2 text-xs text-ink/70">
                          <span className="font-mono">{h.tracking_number}</span>
                          {" · "}
                          {[h.carrier, h.mail_class].filter(Boolean).join(" ")}
                          {h.postage_amount != null ? " · $" + Number(h.postage_amount).toFixed(2) : ""}
                          {" · refund: "}
                          <span className={String(h.refund_status || "").startsWith("failed") ? "text-red-700" : ""}>{h.refund_status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <div className="border-t border-sand/40 lg:hidden" />

              <section className="lg:flex lg:flex-col lg:rounded-3xl lg:border lg:border-sand/60 lg:bg-white lg:p-5 dark:lg:bg-transparent">
                <button onClick={() => setNoteOpen((v) => !v)} aria-expanded={noteOpen}
                  className="flex h-[54px] w-full items-center justify-between px-4 text-left lg:pointer-events-none lg:h-auto lg:px-0 lg:pb-2">
                  <span className="text-[15.5px] text-ink lg:text-xs lg:uppercase lg:tracking-[0.14em] lg:text-taupe">
                    <span className="lg:hidden">Add a note</span>
                    <span className="hidden lg:inline">Note about this package</span>
                  </span>
                  <span className="text-xl leading-none text-taupe lg:hidden">{noteOpen ? "−" : "+"}</span>
                </button>
                <div className={`${noteOpen ? "flex" : "hidden"} flex-col gap-2 px-4 pb-4 lg:flex lg:flex-1 lg:px-0 lg:pb-0`}>
                  <textarea
                    className="input min-h-[76px] resize-none lg:flex-1"
                    placeholder="e.g. Left with neighbor, customer asked to hold"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveNote();
                      }
                    }}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11.5px] text-ink/50">Saves to the order and {firstName(order.to_name) || "the customer"}&apos;s profile</span>
                    <button onClick={saveNote} disabled={!!busy || !noteText.trim()} className="btn-primary shrink-0 !py-2">
                      {busy === "note" ? "Saving…" : "Save note"}
                    </button>
                  </div>
                  {order.customer_notes && (
                    <div className="rounded-xl bg-cream px-3.5 py-2.5 text-xs text-ink/70 dark:bg-transparent dark:ring-1 dark:ring-sand/40">
                      <p className="mb-1 text-ink/80">Customer notes</p>
                      <p className="whitespace-pre-line">{order.customer_notes.split("\n").slice(-4).join("\n")}</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Phone: Reprint always within thumb reach */}
            {!refunded && (
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-sand/60 bg-cream/95 px-4 pt-3 backdrop-blur lg:hidden"
                style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
                <button onClick={reprint} disabled={!!busy}
                  className="flex h-14 w-full items-center justify-center gap-2.5 rounded-[18px] bg-taupe text-[17px] text-cream disabled:opacity-60">
                  <Icon d={I.print} size={20} w={1.8} />
                  {busy === "print" ? "Opening…" : "Reprint label"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {scanning && <BarcodeScanner title="Scan a label" onCode={find} onClose={() => setScanning(false)} />}
    </Shell>
  );
}
