"use client";

// A customer's Messenger link. Used on Create Label, Scan & Send and the
// customer editor.
//   - No link saved: a warning with a box to paste their Facebook/Messenger link.
//   - Messaged the business Page: pick their Page chat so packages can be
//     sent automatically while their 24-hour window is open.

import { useCallback, useEffect, useState } from "react";

export type MessengerInfo = {
  link: string | null;
  openUrl: string | null;
  pageLinked: boolean;
  autoReady: boolean;
  lastMessagedAt: string | null;
  pageEnabled: boolean;
  contacts: { psid: string; name: string | null; lastMessagedAt: string | null; likely: boolean }[];
};

function when(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function MessengerLink({
  customerId,
  customerName,
  full = false,
  onChange,
}: {
  customerId: string;
  customerName?: string | null;
  /** Customer editor: always show the field and the Page chat. */
  full?: boolean;
  onChange?: (info: MessengerInfo) => void;
}) {
  const [info, setInfo] = useState<MessengerInfo | null>(null);
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const first = (customerName || "").trim().split(/\s+/)[0] || "This customer";

  const apply = useCallback(
    (d: MessengerInfo) => {
      setInfo(d);
      setValue(d.link || "");
      onChange?.(d);
    },
    [onChange]
  );

  useEffect(() => {
    let live = true;
    setInfo(null);
    setError(null);
    setEditing(false);
    setSaved(false);
    fetch("/api/customers/" + customerId + "/messenger", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!live) return;
        if (!r.ok) setError(d.error || "Couldn't load the Messenger link.");
        else apply(d);
      })
      .catch(() => live && setError("Couldn't load the Messenger link."));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function save(body: any) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/customers/" + customerId + "/messenger", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Saving failed.");
      // PATCH doesn't return the pick list; keep it unless they're now linked.
      apply({ ...d, contacts: d.pageLinked ? [] : info?.contacts || [] });
      setEditing(false);
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!info) {
    return error ? <p className="text-sm text-red-700">{error}</p> : full ? <div className="h-11 animate-pulse rounded-xl bg-sand/30" /> : null;
  }

  const missing = !info.link;
  const showField = full || missing || editing;

  const field = (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) save({ link: value });
      }}
    >
      <input
        className="input min-w-0 flex-1"
        type="url"
        inputMode="url"
        placeholder="facebook.com/their.name or m.me link"
        aria-label={"Facebook or Messenger link for " + (customerName || "this customer")}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
      />
      <button
        type="submit"
        disabled={busy || !value.trim() || value.trim() === (info.link || "")}
        className="shrink-0 rounded-xl bg-taupe px-4 text-sm text-cream disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );

  const pagePicker =
    info.pageEnabled && !info.pageLinked && info.contacts.length > 0 ? (
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-ink/60">Messaged your Page? Pick their chat so packages send automatically:</p>
        <div className="flex flex-wrap gap-1.5">
          {info.contacts.map((c) => (
            <button
              key={c.psid}
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirm("Link " + (c.name || "this Page chat") + " to " + (customerName || "this customer") + "?")) save({ psid: c.psid });
              }}
              className={`rounded-full border px-3 py-1.5 text-left text-xs ${
                c.likely ? "border-taupe/50 bg-sand/30 text-ink" : "border-sand/60 bg-white text-ink/70 dark:bg-transparent"
              }`}
            >
              {c.name || "Unknown"}
              {c.lastMessagedAt ? <span className="text-ink/45"> · {when(c.lastMessagedAt)}</span> : null}
            </button>
          ))}
        </div>
      </div>
    ) : null;

  const pageStatus = info.pageLinked ? (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/60">
      <span className={`rounded-full px-2 py-0.5 ${info.autoReady ? "bg-emerald-50 text-emerald-700" : "bg-sand/30 text-taupe"}`}>
        {info.autoReady ? "Auto-send ready" : "Page chat linked"}
      </span>
      {info.autoReady
        ? "Messaged your Page " + when(info.lastMessagedAt) + "."
        : info.lastMessagedAt
        ? "Last messaged your Page " + when(info.lastMessagedAt) + ". Sends automatically within 24 hours of their next message."
        : "Sends automatically within 24 hours of their next message to your Page."}
      {full && (
        <button type="button" disabled={busy} onClick={() => save({ psid: null })} className="text-taupe underline underline-offset-2">
          Unlink
        </button>
      )}
    </p>
  ) : null;

  // Customer editor
  if (full) {
    return (
      <div className="flex flex-col gap-2.5">
        {field}
        <p className="text-xs text-ink/50">
          Their Facebook profile or Messenger chat link. Scan &amp; Send opens this chat for you.
          {info.openUrl && (
            <>
              {" "}
              <a href={info.openUrl} target="_blank" rel="noreferrer" className="text-taupe underline underline-offset-2">
                Test it
              </a>
            </>
          )}
        </p>
        {pageStatus}
        {pagePicker}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  // Create Label / Scan & Send: quiet when linked, a warning when not.
  if (!missing && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/60">
        <span className="text-emerald-700">✓ Messenger linked{saved ? " · saved" : ""}</span>
        {info.autoReady && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">Auto-send ready</span>}
        <button type="button" onClick={() => setEditing(true)} className="text-taupe underline underline-offset-2">
          Change
        </button>
        {pagePicker && <div className="w-full pt-1">{pagePicker}</div>}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2.5 rounded-2xl px-4 py-3 ${missing ? "bg-[#fbf1dc]" : "bg-sand/20"}`}>
      {missing && (
        <p className="text-sm text-[#7a5a1e]">
          <strong className="font-semibold">{first} needs their Facebook linked.</strong> Paste their Facebook profile or
          Messenger link so Scan &amp; Send can open their chat.
        </p>
      )}
      {showField && field}
      {editing && !missing && (
        <button type="button" onClick={() => { setEditing(false); setValue(info.link || ""); }} className="self-start text-xs text-taupe underline underline-offset-2">
          Cancel
        </button>
      )}
      {pagePicker}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
