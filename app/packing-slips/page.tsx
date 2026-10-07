"use client";

// Packing Slips — pick orders, add what's in each package, and make one
// branded PDF (4×6 for the thermal printer, or full letter).

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  DEFAULT_SETTINGS,
  SlipOrder,
  SlipSettings,
  buildPackingSlips,
  firstName,
  itemsOf,
  orderLabel,
  properName,
} from "@/lib/packingSlipPdf";

type Range = "week" | "30" | "all";
const DAY = 864e5;
const SETTINGS_KEY = "packingSlipSettings";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PackingSlipsPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const sb = supabase as any;
  const [orders, setOrders] = useState<SlipOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [range, setRange] = useState<Range>("week");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState("");
  const [savingItems, setSavingItems] = useState(false);
  const [settings, setSettings] = useState<SlipSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [missingColumn, setMissingColumn] = useState(false);

  // Remember slip settings on this device
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
    } catch {}
  }, []);
  function updateSettings(patch: Partial<SlipSettings>) {
    setSettings((cur) => {
      const next = { ...cur, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  async function load() {
    const since = range === "all" ? null : new Date(Date.now() - (range === "week" ? 7 : 30) * DAY).toISOString();
    let query = sb
      .from("shipping_orders")
      .select("*")
      .not("tracking_number", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (since) query = query.gte("created_at", since);
    const { data, error } = await query;
    if (error) {
      setMsg({ kind: "err", text: error.message });
      setLoaded(true);
      return;
    }
    const rows: SlipOrder[] = (data || []).filter((o: any) => o.status !== "refunded");
    setMissingColumn(rows.length > 0 && !("slip_items" in (rows[0] as any)));
    setOrders(rows);
    setLoaded(true);
  }
  useEffect(() => {
    setLoaded(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const shown = orders.filter((o) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [o.to_name, orderLabel(o), o.to_city, o.tracking_number].some((v) => String(v || "").toLowerCase().includes(s));
  });

  const focus = orders.find((o) => o.id === focusId) || shown[0] || null;
  useEffect(() => {
    setDraftItems(focus ? String(focus.slip_items || "") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.id]);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const allShownSelected = shown.length > 0 && shown.every((o) => selected.has(o.id));
  function toggleAll() {
    setSelected((cur) => {
      const next = new Set(cur);
      if (allShownSelected) shown.forEach((o) => next.delete(o.id));
      else shown.forEach((o) => next.add(o.id));
      return next;
    });
  }

  async function saveItems() {
    if (!focus) return;
    const value = draftItems.trim() ? draftItems.trim() : null;
    if ((focus.slip_items || null) === value) return;
    setSavingItems(true);
    const { error } = await sb.from("shipping_orders").update({ slip_items: value }).eq("id", focus.id);
    setSavingItems(false);
    if (error) {
      setMsg({ kind: "err", text: missingColumn ? "Run sql/packing_slips.sql in Supabase first, then items will save." : error.message });
      return;
    }
    setOrders((list) => list.map((o) => (o.id === focus.id ? { ...o, slip_items: value } : o)));
  }

  async function generate(ids: string[]) {
    const list = orders.filter((o) => ids.includes(o.id));
    if (!list.length) return;
    await saveItems();
    setBusy(true);
    setMsg(null);
    try {
      // Use the latest typed items for the order being edited, even if not saved
      const withDraft = list.map((o) => (focus && o.id === focus.id ? { ...o, slip_items: draftItems } : o));
      const bytes = await buildPackingSlips(withDraft, settings);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const name = `packing-slips-${new Date().toISOString().slice(0, 10)}.pdf`;
      const win = window.open(url, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
      setMsg({ kind: "ok", text: `Made ${list.length} packing slip${list.length === 1 ? "" : "s"} (${settings.size === "4x6" ? "4×6" : "letter"}).` });
    } catch (e: any) {
      setMsg({ kind: "err", text: "Couldn't make the PDF: " + (e?.message || "unknown error") });
    }
    setBusy(false);
  }

  const previewItems = focus ? (draftItems.trim() ? draftItems.split("\n").map((x) => x.trim()).filter(Boolean) : []) : [];
  const count = selected.size;

  return (
    <Shell>
      <div className="flex flex-col gap-4 pb-24 md:gap-5 lg:pb-0">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Inside every box</p>
            <h1 className="mt-1 text-4xl leading-[1.15] md:text-5xl">Packing Slips</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Slip size" className="flex gap-1 rounded-full bg-sand/30 p-1">
              {(["4x6", "letter"] as const).map((sz) => (
                <button key={sz} role="tab" aria-selected={settings.size === sz} onClick={() => updateSettings({ size: sz })}
                  className={`h-9 rounded-full px-4 text-sm ${settings.size === sz ? "bg-taupe text-cream" : "text-ink/60"}`}>
                  {sz === "4x6" ? "4×6" : "Letter"}
                </button>
              ))}
            </div>
            <button onClick={() => setShowSettings((v) => !v)} className="btn-secondary">Slip text</button>
            <button onClick={() => generate(Array.from(selected))} disabled={!count || busy} className="btn-primary hidden lg:inline-flex">
              {busy ? "Making PDF…" : `Make PDF${count ? ` · ${count}` : ""}`}
            </button>
          </div>
        </div>

        {missingColumn && (
          <p className="rounded-2xl bg-[#fbf1dc] px-4 py-3 text-sm text-[#7a5a1e] dark:bg-transparent dark:text-[#e6c88f] dark:ring-1 dark:ring-[#e6c88f]/40">
            One-time setup: run <span className="font-mono">sql/packing_slips.sql</span> in Supabase so the items you type are saved with each order.
          </p>
        )}
        {msg && (
          <p onClick={() => setMsg(null)} className={`cursor-pointer rounded-2xl px-4 py-3 text-sm ${msg.kind === "ok" ? "bg-sand/30 text-taupe" : "bg-red-50 text-red-700"}`}>
            {msg.text}
          </p>
        )}

        {/* Slip text settings */}
        {showSettings && (
          <section className="card grid gap-3 !rounded-3xl !p-5 md:grid-cols-2 md:!p-6">
            <label className="flex flex-col gap-1.5">
              <span className="label">Thank-you message · Español</span>
              <textarea className="input min-h-[70px]" value={settings.messageEs} onChange={(e) => updateSettings({ messageEs: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">Thank-you message · English</span>
              <textarea className="input min-h-[70px]" value={settings.messageEn} onChange={(e) => updateSettings({ messageEn: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">Returns line</span>
              <input className="input" value={settings.returnsLine} onChange={(e) => updateSettings({ returnsLine: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">Footer</span>
              <input className="input" value={settings.footer} onChange={(e) => updateSettings({ footer: e.target.value })} />
            </label>
            <div className="flex flex-wrap gap-x-6 gap-y-2 md:col-span-2">
              {([
                ["showTracking", "Show service & tracking"],
                ["showReturns", "Show returns line"],
                ["blankLines", "Blank lines when no items are listed"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={settings[key]} onChange={(e) => updateSettings({ [key]: e.target.checked } as Partial<SlipSettings>)} className="h-[18px] w-[18px] accent-taupe" />
                  {label}
                </label>
              ))}
              <button onClick={() => updateSettings({ ...DEFAULT_SETTINGS, size: settings.size })} className="ml-auto text-sm text-taupe underline underline-offset-2">
                Reset to default text
              </button>
            </div>
          </section>
        )}

        <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Orders */}
          <section className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex h-11 flex-1 items-center gap-2 rounded-full border border-sand bg-white px-4 text-taupe dark:bg-transparent">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3" /></svg>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, EB number or city" aria-label="Search orders"
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/40" />
              </label>
              <div role="tablist" aria-label="Date range" className="flex gap-1 self-start rounded-full bg-sand/30 p-1">
                {([["week", "This week"], ["30", "30 days"], ["all", "All"]] as [Range, string][]).map(([r, label]) => (
                  <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)}
                    className={`h-9 rounded-full px-3.5 text-sm ${range === r ? "bg-taupe text-cream" : "text-ink/60"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input type="checkbox" checked={allShownSelected} onChange={toggleAll} disabled={!shown.length} className="h-[18px] w-[18px] accent-taupe" />
                Select all{shown.length ? ` (${shown.length})` : ""}
              </label>
              <span className="text-[13px] text-ink/55">{count} selected</span>
            </div>

            <div className="flex flex-col gap-2">
              {shown.map((o) => {
                const on = selected.has(o.id);
                const isFocus = focus?.id === o.id;
                const n = itemsOf(o).length;
                return (
                  <div key={o.id}
                    className={`flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 transition-shadow dark:bg-transparent ${
                      isFocus ? "ring-2 ring-inset ring-taupe" : "ring-1 ring-inset ring-sand/60"
                    }`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(o.id)} aria-label={`Select ${properName(o.to_name)}`}
                      className="h-[18px] w-[18px] shrink-0 accent-taupe" />
                    <button onClick={() => setFocusId(o.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand/30 text-sm text-taupe">
                        {properName(o.to_name).split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px]">{properName(o.to_name)}</span>
                        <span className="truncate text-[13px] text-ink/55">
                          {orderLabel(o)} · {shortDate(o.created_at)}{o.to_city ? " · " + o.to_city + ", " + (o.to_state || "") : ""}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${n ? "bg-sand/30 text-taupe" : "border border-dashed border-sand text-ink/45"}`}>
                        {n ? `${n} item${n === 1 ? "" : "s"}` : "No items"}
                      </span>
                    </button>
                  </div>
                );
              })}
              {loaded && !shown.length && (
                <div className="card !rounded-3xl text-center text-sm text-ink/55">{q ? "No orders match." : "No orders in this range."}</div>
              )}
              {!loaded && <div className="card !rounded-3xl text-center text-sm text-ink/55">Loading orders…</div>}
            </div>
          </section>

          {/* Preview + items */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            {focus ? (
              <>
                {/* Live preview (matches the PDF) */}
                <div className="mx-auto w-full max-w-[300px]">
                  <div className="flex aspect-[4/6] flex-col overflow-hidden rounded-xl border border-sand/70 bg-white p-4 text-ink shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/EB_Logo_Fall BGBLANK.png" alt="" className="mx-auto h-9 w-auto object-contain" />
                    <div className="mt-2 h-px bg-sand" />
                    <div className="mt-2 flex items-baseline justify-between text-[7px] uppercase tracking-[0.3em] text-taupe">
                      <span>Packing slip</span>
                      <span className="normal-case tracking-normal text-ink/55">{new Date(focus.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                    <p className="mt-0.5 font-heading text-[22px] leading-[1.2] text-taupe">{orderLabel(focus)}</p>
                    <p className="mt-1 text-[6px] uppercase tracking-[0.3em] text-taupe">Ship to</p>
                    <p className="text-[10px] leading-tight">{properName(focus.to_name)}</p>
                    <p className="text-[8.5px] leading-tight text-ink/60">
                      {[focus.to_street1, focus.to_street2].filter(Boolean).join(", ")}
                      <br />
                      {[focus.to_city, focus.to_state].filter(Boolean).join(", ")} {focus.to_zip}
                    </p>
                    {settings.showTracking && (
                      <p className="mt-1 truncate text-[7px] text-ink/55">
                        {[focus.carrier, focus.mail_class].filter(Boolean).join(" ")}
                        {focus.tracking_number ? " · " + focus.tracking_number : ""}
                      </p>
                    )}
                    <div className="mt-2 h-px bg-sand/70" />
                    <p className="mt-1.5 text-[6px] uppercase tracking-[0.3em] text-taupe">En tu paquete · In your package</p>
                    <div className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                      {(previewItems.length ? previewItems : settings.blankLines ? ["", "", "", ""] : []).slice(0, 7).map((it, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="h-[7px] w-[7px] shrink-0 border border-taupe" />
                          {it ? <span className="truncate text-[8.5px]">{it}</span> : <span className="h-px flex-1 bg-sand" />}
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 border-l-2 border-taupe bg-sand/30 px-2.5 py-2">
                      <p className="font-heading text-[14px] leading-[1.2] text-taupe">¡Gracias, {firstName(focus.to_name) || "amiga"}!</p>
                      {settings.messageEs && <p className="text-[8px] leading-snug">{settings.messageEs}</p>}
                      {settings.messageEn && <p className="mt-0.5 text-[7.2px] leading-snug text-ink/60">{settings.messageEn}</p>}
                    </div>
                    {settings.showReturns && settings.returnsLine && <p className="mt-1.5 text-center text-[7px] text-ink/60">{settings.returnsLine}</p>}
                    {settings.footer && <p className="mt-0.5 text-center text-[6.8px] text-taupe">{settings.footer}</p>}
                  </div>
                  <p className="mt-2 text-center text-xs text-ink/50">Preview · {settings.size === "4x6" ? "4×6" : "Letter"}</p>
                </div>

                {/* Items editor */}
                <section className="card flex flex-col gap-2.5 !rounded-3xl !p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[15px]">What&apos;s in {firstName(focus.to_name) || "this"}&apos;s package</p>
                    <span className="text-xs text-ink/50">{savingItems ? "Saving…" : "One per line"}</span>
                  </div>
                  <textarea
                    className="input min-h-[120px]"
                    placeholder={"Blusa floral (M)\nJeans skinny (7)\nAretes dorados"}
                    value={draftItems}
                    onChange={(e) => setDraftItems(e.target.value)}
                    onBlur={saveItems}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => generate([focus.id])} disabled={busy} className="btn-secondary flex-1">
                      {busy ? "Making…" : "PDF for this order"}
                    </button>
                    <button onClick={() => toggle(focus.id)} className="btn-secondary">
                      {selected.has(focus.id) ? "Unselect" : "Select"}
                    </button>
                  </div>
                </section>
              </>
            ) : (
              <div className="card !rounded-3xl text-center text-sm text-ink/55">Pick an order to preview its slip.</div>
            )}
          </aside>
        </div>
      </div>

      {/* Phone: generate button always in reach */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-sand/60 bg-cream/95 px-4 pt-3 backdrop-blur lg:hidden"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        <button onClick={() => generate(Array.from(selected))} disabled={!count || busy}
          className="flex h-14 w-full items-center justify-center rounded-[18px] bg-taupe text-[17px] text-cream disabled:opacity-50">
          {busy ? "Making PDF…" : count ? `Make PDF · ${count} slip${count === 1 ? "" : "s"}` : "Select orders to make slips"}
        </button>
      </div>
    </Shell>
  );
}
