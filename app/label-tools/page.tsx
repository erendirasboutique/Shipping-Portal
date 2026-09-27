"use client";

// Scan a Label — scan any shipping label to reprint it, void it, or log
// that the package came back (returned to sender) and send it again.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
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
function firstName(n: string | null) {
  const f = (n || "").trim().split(/\s+/)[0] || "";
  return f ? f.charAt(0).toUpperCase() + f.slice(1).toLowerCase() : "";
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
  const [changeOpen, setChangeOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

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
      setChangeOpen(false);
      setNoteText("");
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

  const refunded = order ? order.status === "refunded" || !!order.refund_status : false;

  return (
    <Shell>
      <div className="card !rounded-[2rem] !p-6 md:!p-8">
        <p className="eyebrow">Fix a label</p>
        <h1 className="mt-1 text-5xl">Scan a Label</h1>
        <p className="mt-2 text-sm text-ink/70">Reprint a smudged label, void a mistake, or log a package that came back.</p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button onClick={() => setScanning(true)} className="btn-primary !px-6 !py-3.5 !text-base">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" />
              <path d="M8 9v6M11 9v6M14 9v6M16.5 9v6" />
            </svg>
            Scan label
          </button>
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              typedSearch();
            }}
          >
            <input className="input" placeholder="Or type tracking or EB-123" value={typed} onChange={(e) => setTyped(e.target.value)} />
            <button type="submit" disabled={!typed.trim() || !!busy} className="btn-secondary shrink-0">Find</button>
          </form>
        </div>

        {msg && (
          <p
            className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
              msg.kind === "ok"
                ? "bg-[#e6efdf] text-[#3f6a2e] dark:bg-transparent dark:text-[#a9cf98] dark:ring-1 dark:ring-[#a9cf98]/40"
                : "bg-red-50 text-red-700"
            }`}
          >
            {msg.text}
          </p>
        )}
      </div>

      {order && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* Order */}
          <div className="card !rounded-[2rem] !p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">{label(order)}</p>
                <p className="mt-1 truncate font-heading text-3xl text-taupe">{order.to_name || "Customer"}</p>
                <p className="text-sm text-ink/70">
                  {[order.to_street1, order.to_street2].filter(Boolean).join(", ")}
                  <br />
                  {[order.to_city, order.to_state].filter(Boolean).join(", ")} {order.to_zip}
                </p>
              </div>
              <Link href={"/orders/" + order.id} className="shrink-0 text-sm text-taupe underline underline-offset-2">Open order</Link>
            </div>

            {order.tracking_number && (
              <p className="mt-4 break-all rounded-2xl bg-cream px-3 py-2 font-mono text-xs text-ink/70 dark:bg-transparent">
                {[order.carrier, order.mail_class].filter(Boolean).join(" ")}
                {order.carrier ? " · " : ""}
                {order.tracking_number}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
              {refunded && (
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">Voided · {order.refund_status || "refunded"}</span>
              )}
              {order.rts_at && (
                <span className="rounded-full bg-[#fbf1dc] px-2.5 py-1 text-[#7a5a1e] dark:bg-transparent dark:text-[#e6c88f] dark:ring-1 dark:ring-[#e6c88f]/40">
                  Returned to sender {when(order.rts_at)}
                </span>
              )}
              <span className="rounded-full bg-sand/30 px-2.5 py-1 text-ink/70">Bought {when(order.created_at)}</span>
              {order.printed_at && <span className="rounded-full bg-sand/30 px-2.5 py-1 text-ink/70">Printed {when(order.printed_at)}</span>}
              {order.packed_at && <span className="rounded-full bg-sand/30 px-2.5 py-1 text-ink/70">Packed</span>}
              {!!order.insurance_amount && (
                <span className="rounded-full bg-sand/30 px-2.5 py-1 text-ink/70">Insured ${Number(order.insurance_amount).toFixed(0)}</span>
              )}
            </div>

            {Array.isArray(order.label_history) && order.label_history.length > 0 && (
              <div className="mt-5">
                <p className="label">Replaced labels</p>
                <div className="space-y-1.5">
                  {order.label_history
                    .slice()
                    .reverse()
                    .map((h: any, i: number) => (
                      <div key={i} className="rounded-2xl border border-taupe/15 px-3.5 py-2 text-xs text-ink/70">
                        <span className="font-mono">{h.tracking_number}</span>
                        {" · "}
                        {[h.carrier, h.mail_class].filter(Boolean).join(" ")}
                        {h.postage_amount != null ? " · $" + Number(h.postage_amount).toFixed(2) : ""}
                        <br />
                        Replaced {when(h.replaced_at)}
                        {h.reason ? " (" + h.reason + ")" : ""}
                        {" · refund: "}
                        <span className={String(h.refund_status || "").startsWith("failed") ? "text-red-700" : ""}>{h.refund_status}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="card !rounded-[2rem] !p-6">
            <p className="label">What do you need?</p>
            <div className="space-y-3">
              <button onClick={reprint} disabled={!!busy || refunded} className="btn-primary w-full !py-3.5">
                {busy === "print" ? "Opening…" : "Reprint label"}
              </button>
              <button
                onClick={voidLabel}
                disabled={!!busy || refunded}
                className="btn-secondary w-full !py-3.5 border-red-400/50 text-red-700 hover:bg-red-50"
              >
                {busy === "void" ? "Voiding…" : refunded ? "Label already voided" : "Void label & refund"}
              </button>
              {!changeOpen && (
                <button onClick={() => setChangeOpen(true)} disabled={!!busy || refunded} className="btn-secondary w-full !py-3.5">
                  Change service, weight or insurance
                </button>
              )}
              {!order.rts_at && !rtsOpen && (
                <button onClick={() => setRtsOpen(true)} disabled={!!busy} className="btn-secondary w-full !py-3.5">
                  Package came back (returned to sender)
                </button>
              )}
            </div>

            {changeOpen && !refunded && (
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
            )}
            {!refunded && (
              <p className="mt-3 text-xs text-ink/50">
                Carriers only refund labels that haven&apos;t been scanned by the post office, usually within 30 days.
              </p>
            )}

            {/* Log a returned package */}
            {rtsOpen && !order.rts_at && (
              <div className="mt-5 rounded-3xl border border-taupe/20 p-4">
                <p className="label">Why did it come back?</p>
                <div className="flex flex-wrap gap-2">
                  {RTS_REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRtsReason(r)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm ${
                        rtsReason === r ? "border-taupe bg-taupe text-cream dark:text-[#26211b]" : "border-taupe/30 text-taupe hover:bg-taupe/10"
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
              </div>
            )}

            {/* After it's logged: next steps */}
            {order.rts_at && (
              <div className="mt-5 rounded-3xl border border-[#e6c88f]/60 bg-[#fdf8ee] p-4 dark:bg-transparent">
                <p className="text-sm font-medium">Returned to sender{order.rts_reason ? ": " + order.rts_reason : ""}</p>
                <p className="mt-0.5 text-xs text-ink/60">
                  Logged {when(order.rts_at)}
                  {order.rts_by ? " by " + order.rts_by.split("@")[0] : ""}
                </p>

                <ol className="mt-3 space-y-3 text-sm">
                  <li>
                    <p className="font-medium">1. Ask the customer to confirm their address</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <button onClick={copyMessage} className="btn-secondary !py-2 text-xs">
                        {copied ? "Message copied ✓" : "Copy message (ES + EN)"}
                      </button>
                    </div>
                  </li>
                  <li>
                    <p className="font-medium">2. Send it again</p>
                    {order.reshipped_to ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-ink/60">Re-ship started: {order.reship_label || "new order"}</span>
                        <Link href={"/create-label?draft=" + order.reshipped_to} className="btn-secondary !py-2 text-xs">Open it</Link>
                      </div>
                    ) : (
                      <button onClick={reship} disabled={!!busy} className="btn-primary mt-1.5 !py-2 text-xs">
                        {busy === "reship" ? "Setting up…" : "Fix address & re-ship"}
                      </button>
                    )}
                    <p className="mt-1 text-xs text-ink/50">
                      Opens Create Label with the same customer and package filled in. Fix the address, then buy the new label.
                    </p>
                  </li>
                </ol>

                <button onClick={undoRts} disabled={!!busy} className="mt-4 text-xs text-taupe underline underline-offset-2">
                  Marked by mistake? Undo
                </button>
              </div>
            )}

            {/* Customer note */}
            <div className="mt-5 border-t border-taupe/15 pt-5">
              <p className="label">Note about this package</p>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="e.g. Left with neighbor, customer asked to hold"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveNote();
                  }}
                />
                <button onClick={saveNote} disabled={!!busy || !noteText.trim()} className="btn-secondary shrink-0">
                  {busy === "note" ? "Saving…" : "Save"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-ink/50">Saved with today&apos;s date and EB number on the customer&apos;s profile and this order.</p>
              {order.customer_notes && (
                <div className="mt-3 rounded-2xl bg-cream/70 px-3.5 py-2.5 text-xs text-ink/70 dark:bg-transparent dark:ring-1 dark:ring-taupe/20">
                  <p className="mb-1 font-medium text-ink/80">Customer notes</p>
                  <p className="whitespace-pre-line">{order.customer_notes.split("\n").slice(-4).join("\n")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {scanning && <BarcodeScanner title="Scan a label" onCode={find} onClose={() => setScanning(false)} />}
    </Shell>
  );
}
