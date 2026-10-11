"use client";

// Live List — Friday night: type each paid customer's name, press Enter,
// it gets the next number for the week (#1, #2…), and a Print button sits
// right next to it for the inside + outside stickers. Saturday: type that
// number on Create Label to pull the customer up. Numbers restart Sunday.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";

type Row = {
  id: string;
  number: number;
  name: string;
  order_id: string | null;
  order?: { order_number: number | null; tracking_number: string | null; label_url: string | null } | null;
};

function weekLabel(week: string | null) {
  if (!week) return "";
  const [y, m, d] = week.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function LiveListPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/live-list", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load the list.");
      setRows(data.rows);
      setWeek(data.week);
    } catch (e: any) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    // Two people can work the list at once; keep it fresh.
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setErr("Type the customer's name first.");
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/live-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add that name.");
      setRows((r) => [...(r ?? []).filter((x) => x.id !== data.row.id), data.row].sort((a, b) => a.number - b.number));
      setJustAdded(data.row.id);
      setName("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function remove(id: string) {
    setConfirmDelete(null);
    const res = await fetch(`/api/live-list/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setErr(data.error || "Couldn't remove that row.");
    load();
  }

  const latest = rows?.find((r) => r.id === justAdded);
  const nextNumber = (rows ?? []).reduce((m, r) => Math.max(m, r.number), 0) + 1;

  return (
    <Shell>
      <div className="card !rounded-[2rem] !p-6 md:!p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Week of {weekLabel(week) || "…"}</p>
            <h1 className="mt-1 text-5xl">Live List</h1>
          </div>
          <Link href="/create-label" className="btn-secondary">Create Label</Link>
        </div>

        {/* Add a name */}
        <form onSubmit={add} className="mt-6 rounded-3xl bg-cream/70 p-5 dark:bg-transparent dark:ring-1 dark:ring-taupe/20">
          <label className="label" htmlFor="live-name">Paid customer — name from Facebook</label>
          <div className="flex gap-2">
            <input
              id="live-name"
              ref={inputRef}
              className="input !text-base"
              placeholder="Maria Naranjo"
              value={name}
              autoFocus
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => {
                setName(e.target.value);
                setErr(null);
              }}
            />
            <button type="submit" className="btn-primary shrink-0" disabled={busy}>
              {busy ? "Adding…" : `Add #${nextNumber}`}
            </button>
          </div>

          {latest ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3">
              <span className="font-heading text-4xl text-taupe">#{latest.number}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{latest.name}</span>
                <span className="text-xs text-ink/60">Write #{latest.number} on the mailer, then print the stickers.</span>
              </span>
              <a
                href={`/api/live-list/${latest.id}/stickers`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
              >
                Print 2 stickers
              </a>
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink/60">
              Press Enter to add. Each name gets the next number, and a Print button for its inside and outside stickers.
            </p>
          )}
        </form>

        {err && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}

        {/* The list */}
        <div className="mt-6 space-y-2.5">
          {!rows && !err && <p className="py-8 text-center text-sm text-ink/50">Loading…</p>}
          {rows && rows.length === 0 && (
            <p className="rounded-3xl border border-taupe/10 bg-cream/70 px-5 py-8 text-center text-sm text-ink/50 dark:bg-transparent">
              No packages yet this week. Add the first name above — it becomes #1.
            </p>
          )}
          {rows?.map((r) => {
            const shipped = Boolean(r.order?.tracking_number || r.order?.label_url);
            return (
              <div
                key={r.id}
                className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${
                  r.id === justAdded ? "border-taupe bg-cream/60" : "border-taupe/15 bg-white"
                }`}
              >
                <span className="w-14 shrink-0 text-center font-heading text-3xl tabular-nums text-taupe">#{r.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="text-xs text-ink/60">
                    {shipped
                      ? `Label bought${r.order?.order_number != null ? ` · EB-${r.order.order_number}` : ""}`
                      : r.order_id
                      ? `Draft${r.order?.order_number != null ? ` · EB-${r.order.order_number}` : ""}`
                      : "Needs a label"}
                  </span>
                </span>
                <a
                  href={`/api/live-list/${r.id}/stickers`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary !px-4 !py-2"
                >
                  Print
                </a>
                {!r.order_id &&
                  (confirmDelete === r.id ? (
                    <span className="flex gap-1">
                      <button className="btn-danger !px-3 !py-2" onClick={() => remove(r.id)}>Remove #{r.number}</button>
                      <button className="btn-secondary !px-3 !py-2" onClick={() => setConfirmDelete(null)}>Keep</button>
                    </span>
                  ) : (
                    <button
                      className="px-2 py-2 text-xs text-ink/50 hover:text-red-700"
                      onClick={() => setConfirmDelete(r.id)}
                      aria-label={`Remove #${r.number} ${r.name}`}
                    >
                      Remove
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
