"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import Shell from "@/components/Shell";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/fetchAll";

const empty = {
  name: "", email: "", phone: "", street1: "", street2: "",
  city: "", state: "", zip: "", country: "US", notes: "",
};

type DupeGroup = { key: string; reason: string; customers: any[] };

function findDuplicates(customers: any[]): DupeGroup[] {
  const groups: DupeGroup[] = [];
  const add = (map: Map<string, any[]>, reason: string) => {
    map.forEach((list, key) => {
      if (list.length > 1) groups.push({ key: `${reason}:${key}`, reason, customers: list });
    });
  };
  const byEmail = new Map<string, any[]>();
  const byPhone = new Map<string, any[]>();
  const byNameZip = new Map<string, any[]>();
  const byAddress = new Map<string, any[]>();
  for (const c of customers) {
    const email = (c.email || "").trim().toLowerCase();
    const phone = (c.phone || "").replace(/\D/g, "");
    const nameZip = c.name && c.zip ? `${c.name.trim().toLowerCase()}|${c.zip.trim()}` : "";
    const addr = c.street1 && c.zip ? `${c.street1.trim().toLowerCase()}|${c.zip.trim()}` : "";
    if (email) byEmail.set(email, [...(byEmail.get(email) || []), c]);
    if (phone) byPhone.set(phone, [...(byPhone.get(phone) || []), c]);
    if (nameZip) byNameZip.set(nameZip, [...(byNameZip.get(nameZip) || []), c]);
    if (addr) byAddress.set(addr, [...(byAddress.get(addr) || []), c]);
  }
  add(byEmail, "Same email");
  add(byPhone, "Same phone");
  add(byNameZip, "Same name + ZIP");
  add(byAddress, "Same address");
  // De-dupe groups that contain the same customer sets
  const seen = new Set<string>();
  return groups.filter((g) => {
    const sig = g.customers.map((c) => c.id).sort().join(",");
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

/* ---------- Small presentational helpers ---------- */

function initials(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Avatars stay in the boutique palette.
const AVATAR_TINTS = ["bg-sand/40 text-taupe", "bg-sand/60 text-taupe", "bg-taupe/15 text-taupe"];

function avatarTint(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

function Avatar({ name, id, size = "md" }: { name?: string; id?: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${dims} ${avatarTint(id || name || "")}`}>
      {initials(name)}
    </span>
  );
}

function location(c: any) {
  return [c.city, c.state].filter(Boolean).join(", ");
}

type Filter = "all" | "month" | "noEmail" | "noAddress";
type Stat = { count: number; last: string | null };

function shortDay(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", sameYear ? { month: "short", day: "numeric" } : { month: "short", year: "numeric" });
}

function letterOf(name?: string) {
  const ch = (name || "").trim().charAt(0).toUpperCase();
  return ch >= "A" && ch <= "Z" ? ch : "#";
}

const LETTERS = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function statusTone(status?: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("deliver")) return "bg-emerald-100 text-emerald-800";
  if (s.includes("ship") || s.includes("transit")) return "bg-sky-100 text-sky-800";
  if (s.includes("cancel") || s.includes("void") || s.includes("return")) return "bg-rose-100 text-rose-800";
  if (s.includes("label") || s.includes("pending") || s.includes("new")) return "bg-amber-100 text-amber-800";
  return "bg-sand/40 text-taupe";
}

const Icon = {
  search: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="m8 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M10 13V3m0 0L6 7m4-4 4 4M4 13v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 19c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.5" /><path d="M16 14.2c2.6.2 4.6 1.8 5.3 4.3" strokeLinecap="round" />
    </svg>
  ),
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/45">{children}</p>;
}

/* ---------- Page ---------- */

export default function CustomersPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any | null>(null); // customer object or {...empty} for new
  const [showMerge, setShowMerge] = useState(false);
  const [mergeGroup, setMergeGroup] = useState<DupeGroup | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  async function load() {
    // Every customer, loaded 1,000 at a time (a plain select stops at 1,000).
    const data = await fetchAll((from, to) =>
      supabase
        .from("shipping_customers")
        .select("*")
        .eq("archived", false)
        .order("name")
        .order("id")
        .range(from, to)
    ).catch(() => [] as any[]);
    setCustomers(data);
    setLoaded(true);
    // Light order list for the Orders / Last shipped columns (matched like the profile: email, then name).
    const ords = await fetchAll((from, to) =>
      supabase
        .from("shipping_orders")
        .select("id, to_email, to_name, created_at")
        .order("created_at", { ascending: false })
        .range(from, to)
    ).catch(() => [] as any[]);
    setOrders(ords);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close whichever modal is open with Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (editing) { setEditing(null); setLinkCopied(false); }
      else if (showMerge) { setShowMerge(false); setMergeGroup(null); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, showMerge]);

  // Orders and last ship date per customer.
  const stats = useMemo(() => {
    const byEmail = new Map<string, any[]>();
    const byName = new Map<string, any[]>();
    for (const o of orders) {
      const e = (o.to_email || "").trim().toLowerCase();
      const n = (o.to_name || "").trim().toLowerCase();
      if (e) byEmail.set(e, [...(byEmail.get(e) || []), o]);
      if (n) byName.set(n, [...(byName.get(n) || []), o]);
    }
    const out = new Map<string, Stat>();
    for (const c of customers) {
      const list = [
        ...(byEmail.get((c.email || "").trim().toLowerCase()) || []),
        ...(byName.get((c.name || "").trim().toLowerCase()) || []),
      ];
      const ids = new Set<string>();
      let last: string | null = null;
      for (const o of list) {
        if (ids.has(o.id)) continue;
        ids.add(o.id);
        if (!last || o.created_at > last) last = o.created_at;
      }
      out.set(c.id, { count: ids.size, last });
    }
    return out;
  }, [customers, orders]);

  const monthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  }, []);

  const matchesFilter = (c: any, f: Filter) => {
    if (f === "month") return (stats.get(c.id)?.last || "") >= monthStart;
    if (f === "noEmail") return !c.email;
    if (f === "noAddress") return !c.street1 || !c.zip;
    return true;
  };

  const counts = useMemo(() => {
    const n = { all: customers.length, month: 0, noEmail: 0, noAddress: 0 };
    for (const c of customers) {
      if (matchesFilter(c, "month")) n.month++;
      if (matchesFilter(c, "noEmail")) n.noEmail++;
      if (matchesFilter(c, "noAddress")) n.noAddress++;
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, stats, monthStart]);

  const shown = customers.filter((c) => {
    if (!matchesFilter(c, filter)) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return [c.name, c.email, c.phone, c.city, c.zip].some((v) => (v || "").toLowerCase().includes(s));
  });

  // First row for each letter, for the A–Z jump strip.
  const firstOfLetter = new Map<string, string>();
  for (const c of shown) {
    const L = letterOf(c.name);
    if (!firstOfLetter.has(L)) firstOfLetter.set(L, c.id);
  }
  function jumpTo(L: string) {
    const id = firstOfLetter.get(L);
    if (!id) return;
    const el = document.querySelector(`[data-cust-row="${id}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const dupes = useMemo(() => findDuplicates(customers), [customers]);

  // Load this customer's orders when the edit modal opens (matched by email, then name)
  useEffect(() => {
    if (!editing?.id) {
      setCustomerOrders([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setOrdersLoading(true);
      const seen = new Set<string>();
      const merged: any[] = [];
      const cols = "id, order_number, created_at, status, carrier, mail_class, tracking_number, postage_amount";
      if (editing.email) {
        const { data } = await supabase
          .from("shipping_orders")
          .select(cols)
          .ilike("to_email", editing.email)
          .order("created_at", { ascending: false });
        (data || []).forEach((o) => { if (!seen.has(o.id)) { seen.add(o.id); merged.push(o); } });
      }
      if (editing.name) {
        const { data } = await supabase
          .from("shipping_orders")
          .select(cols)
          .ilike("to_name", editing.name)
          .order("created_at", { ascending: false });
        (data || []).forEach((o) => { if (!seen.has(o.id)) { seen.add(o.id); merged.push(o); } });
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (!cancelled) {
        setCustomerOrders(merged);
        setOrdersLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  function closeEditor() {
    setEditing(null);
    setLinkCopied(false);
  }

  function copyPortalLink() {
    if (!editing?.portal_token) return;
    navigator.clipboard.writeText("https://my.erendirasboutique.com/account?t=" + editing.portal_token);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function save() {
    if (!editing?.name?.trim()) return setMsg("Name is required.");
    setBusy(true);
    const payload = {
      name: editing.name.trim(),
      email: editing.email?.trim().toLowerCase() || null,
      phone: editing.phone?.trim() || null,
      street1: editing.street1?.trim() || null,
      street2: editing.street2?.trim() || null,
      city: editing.city?.trim() || null,
      state: editing.state?.trim().toUpperCase() || null,
      zip: editing.zip?.trim() || null,
      country: editing.country?.trim().toUpperCase() || "US",
      notes: editing.notes?.trim() || null,
    };
    // Update by id (never re-insert) so edits can't hit duplicate-key errors.
    const { error } = editing.id
      ? await supabase.from("shipping_customers").update(payload).eq("id", editing.id)
      : await supabase.from("shipping_customers").insert(payload);
    setBusy(false);
    if (error) return setMsg(error.message);
    setEditing(null);
    load();
  }

  function importCsv(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      error: (err) => setMsg(`Couldn't read that file: ${err.message}`),
      complete: async (result) => {
        if (!result.data?.length) {
          setMsg("That CSV appears to be empty.");
          return;
        }
        setBusy(true);
        const res = await fetch("/api/customers/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: result.data }),
        });
        const data = await res.json().catch(() => ({}));
        setBusy(false);
        setMsg(
          res.ok
            ? `Imported ${data.imported} customers${data.skipped ? ` (${data.skipped} rows skipped — no name)` : ""}.`
            : data.error || "Import failed."
        );
        load();
      },
    });
  }

  async function deleteCustomer() {
    if (!editing?.id) return;
    if (!confirm(`Delete ${editing.name || "this customer"}? This can't be undone. Their past orders are kept, but they'll no longer match a customer record.`)) return;
    setBusy(true);
    // Archived duplicates merged into this customer reference it via merged_into,
    // which blocks deletion — detach them first.
    const { error: unlinkError } = await supabase
      .from("shipping_customers")
      .update({ merged_into: null })
      .eq("merged_into", editing.id);
    if (unlinkError) {
      setBusy(false);
      return setMsg(unlinkError.message);
    }
    const { error } = await supabase.from("shipping_customers").delete().eq("id", editing.id);
    setBusy(false);
    if (error) return setMsg(error.message);
    setEditing(null);
    setLinkCopied(false);
    setMsg("Customer deleted.");
    load();
  }

  async function merge() {
    if (!mergeGroup || !primaryId) return;
    setBusy(true);
    const res = await fetch("/api/customers/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primary_id: primaryId,
        duplicate_ids: mergeGroup.customers.map((c) => c.id).filter((id) => id !== primaryId),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(data.error);
    setMsg(`Merged ${data.merged} duplicate${data.merged === 1 ? "" : "s"}. Orders moved to the main customer; duplicates archived.`);
    setMergeGroup(null);
    setPrimaryId(null);
    load();
  }

  const searching = q.trim().length > 0;

  return (
    <Shell>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Customers</h1>
          <p className="mt-1 text-sm text-ink/55">
            {loaded
              ? `${customers.length.toLocaleString()} customer${customers.length === 1 ? "" : "s"} in your directory`
              : "Loading your directory…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) importCsv(e.target.files[0]); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-secondary inline-flex items-center gap-2">
            {Icon.upload} Import CSV
          </button>
          <button onClick={() => setShowMerge(true)} className="btn-secondary inline-flex items-center gap-2">
            Find duplicates
            {dupes.length > 0 && (
              <span className="rounded-full bg-sand/40 px-2 py-0.5 text-xs font-semibold text-taupe">{dupes.length}</span>
            )}
          </button>
          <button onClick={() => setEditing({ ...empty })} className="btn-primary inline-flex items-center gap-2">
            {Icon.plus} Add customer
          </button>
        </div>
      </div>

      {/* Flash message */}
      {msg && (
        <div className="mt-5 flex items-start justify-between gap-3 rounded-xl border border-sand/70 bg-sand/25 px-4 py-3 text-sm text-taupe">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} aria-label="Dismiss" className="shrink-0 rounded-md p-0.5 text-taupe/70 hover:bg-sand/50 hover:text-taupe">
            {Icon.close}
          </button>
        </div>
      )}

      {/* Search + filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <div className="relative w-full max-w-md">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-taupe/70">{Icon.search}</span>
          <input
            className="input !pl-10 !pr-9"
            placeholder="Search name, email, phone, city or ZIP"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {searching && (
            <button onClick={() => setQ("")} aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink/40 hover:bg-sand/40 hover:text-ink/70">
              {Icon.close}
            </button>
          )}
        </div>
        {([
          ["all", "All", counts.all],
          ["month", "Shipped this month", counts.month],
          ["noEmail", "Missing email", counts.noEmail],
          ["noAddress", "Missing address", counts.noAddress],
        ] as [Filter, string, number][]).map(([key, label, n]) => {
          const on = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              aria-pressed={on}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors ${
                on ? "border-taupe bg-taupe text-cream" : "border-sand text-taupe hover:border-taupe/50"
              }`}
            >
              {label}
              <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${on ? "bg-cream/25" : "bg-sand/40"}`}>
                {loaded ? n.toLocaleString() : "…"}
              </span>
            </button>
          );
        })}
        {(searching || filter !== "all") && loaded && (
          <span className="text-sm text-ink/55">{shown.length.toLocaleString()} shown</span>
        )}
      </div>

      {/* Directory */}
      <div className="relative mt-4">
        <div className="card overflow-hidden !p-0 md:mr-8">
          {!loaded ? (
            <ul className="divide-y divide-sand/30">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="flex animate-pulse items-center gap-3 px-5 py-3.5">
                  <span className="h-9 w-9 rounded-full bg-sand/40" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 rounded bg-sand/50" />
                    <div className="h-3 w-56 rounded bg-sand/30" />
                  </div>
                </li>
              ))}
            </ul>
          ) : !shown.length ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="text-taupe/40">{Icon.people}</span>
              {searching || filter !== "all" ? (
                <>
                  <p className="mt-3 font-medium">No customers match{searching ? ` “${q.trim()}”` : " this filter"}</p>
                  <button onClick={() => { setQ(""); setFilter("all"); }} className="mt-3 text-sm text-taupe underline underline-offset-2">Show everyone</button>
                </>
              ) : (
                <>
                  <p className="mt-3 font-medium">No customers yet</p>
                  <p className="mt-1 text-sm text-ink/55">Add your first customer or import a CSV to get started.</p>
                  <div className="mt-5 flex gap-2">
                    <button onClick={() => fileRef.current?.click()} className="btn-secondary">Import CSV</button>
                    <button onClick={() => setEditing({ ...empty })} className="btn-primary">Add customer</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <table className="hidden w-full md:table">
                <thead className="border-b border-sand/60 bg-sand/10">
                  <tr>
                    <th className="table-th">Customer</th>
                    <th className="table-th">Contact</th>
                    <th className="table-th">Location</th>
                    <th className="table-th">Orders</th>
                    <th className="table-th">Last shipped</th>
                    <th className="table-th w-10" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => {
                    const st = stats.get(c.id);
                    const anchor = firstOfLetter.get(letterOf(c.name)) === c.id;
                    return (
                      <tr key={c.id} data-cust-row={c.id} onClick={() => setEditing(c)}
                        className={`group cursor-pointer border-b border-sand/30 transition-colors last:border-0 hover:bg-sand/15 ${anchor ? "scroll-mt-4" : ""}`}>
                        <td className="table-td !py-2.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={c.name} id={c.id} size="sm" />
                            <p className="truncate font-medium">{c.name}</p>
                          </div>
                        </td>
                        <td className="table-td !py-2.5">
                          {c.email || c.phone ? (
                            <div className="min-w-0 text-sm">
                              {c.email && <p className="truncate text-ink/70">{c.email}</p>}
                              {c.phone && <p className="truncate tabular-nums text-ink/55">{c.phone}</p>}
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditing(c); }}
                              className="text-sm text-taupe hover:underline"
                            >
                              + Add email
                            </button>
                          )}
                        </td>
                        <td className="table-td !py-2.5">
                          {location(c) ? (
                            <span>
                              {location(c)} <span className="tabular-nums text-ink/50">{c.zip}</span>
                            </span>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditing(c); }}
                              className="text-sm text-taupe hover:underline"
                            >
                              + Add address
                            </button>
                          )}
                        </td>
                        <td className="table-td !py-2.5 tabular-nums">{st?.count || <span className="text-ink/35">0</span>}</td>
                        <td className="table-td !py-2.5 text-sm text-ink/60">{shortDay(st?.last ?? null) || <span className="text-ink/35">—</span>}</td>
                        <td className="table-td !py-2.5 text-sand transition-colors group-hover:text-taupe">{Icon.chevron}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile list */}
              <ul className="divide-y divide-sand/30 md:hidden">
                {shown.map((c) => {
                  const st = stats.get(c.id);
                  return (
                    <li key={c.id} data-cust-row={c.id}>
                      <button onClick={() => setEditing(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sand/15">
                        <Avatar name={c.name} id={c.id} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{c.name}</p>
                          <p className="truncate text-sm text-ink/55">
                            {[location(c), st?.count ? `${st.count} order${st.count === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || "No address yet"}
                          </p>
                        </div>
                        <span className="text-sand">{Icon.chevron}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* A–Z jump strip (desktop) */}
        {loaded && shown.length > 20 && (
          <nav aria-label="Jump to letter" className="absolute bottom-0 right-0 top-0 hidden md:block">
            <div className="sticky top-6 flex flex-col items-center gap-px">
              {LETTERS.map((L) => {
                const has = firstOfLetter.has(L);
                return (
                  <button
                    key={L}
                    onClick={() => jumpTo(L)}
                    disabled={!has}
                    aria-label={`Jump to ${L}`}
                    className="h-[19px] w-6 rounded text-[11px] leading-none text-taupe hover:bg-sand/40 disabled:text-sand"
                  >
                    {L}
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>

      {/* Add/Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]" onClick={closeEditor}>
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-cream shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center gap-3 border-b border-sand/50 px-6 py-4">
              {editing.id ? <Avatar name={editing.name} id={editing.id} size="lg" /> : null}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-2xl">{editing.id ? editing.name || "Edit customer" : "Add customer"}</h2>
                {editing.id && (
                  <p className="truncate text-sm text-ink/55">{[editing.email, location(editing)].filter(Boolean).join(" · ") || "Edit details below"}</p>
                )}
              </div>
              <button onClick={closeEditor} aria-label="Close" className="rounded-lg p-1.5 text-ink/50 hover:bg-sand/40 hover:text-ink">
                {Icon.close}
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <section>
                <SectionTitle>Contact</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2"><label className="label">Name</label>
                    <input className="input" autoFocus={!editing.id} value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                  <div><label className="label">Email</label>
                    <input className="input" type="email" value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
                  <div><label className="label">Phone</label>
                    <input className="input" type="tel" value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
                </div>
              </section>

              <section>
                <SectionTitle>Shipping address</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2"><label className="label">Street</label>
                    <AddressAutocomplete
                      value={editing.street1 || ""}
                      placeholder="Start typing an address"
                      onChange={(v) => setEditing((cur: any) => ({ ...cur, street1: v }))}
                      onSelect={(a) => {
                        setEditing((cur: any) => ({
                          ...cur,
                          street1: a.street1,
                          street2: a.street2 || cur.street2,
                          city: a.city,
                          state: a.state,
                          zip: a.zip,
                          country: "US",
                        }));
                        setTimeout(function () { var el = document.getElementById("cust_street2"); if (el) el.focus(); }, 0);
                      }}
                    /></div>
                  <div className="sm:col-span-2"><label className="label">Apt / Suite <span className="font-normal text-ink/40">(optional)</span></label>
                    <input id="cust_street2" className="input" value={editing.street2 || ""} onChange={(e) => setEditing({ ...editing, street2: e.target.value })} /></div>
                  <div><label className="label">City</label>
                    <input className="input" value={editing.city || ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">State</label>
                      <input className="input uppercase" maxLength={2} value={editing.state || ""} onChange={(e) => setEditing({ ...editing, state: e.target.value.toUpperCase() })} /></div>
                    <div><label className="label">ZIP</label>
                      <input className="input" inputMode="numeric" value={editing.zip || ""} onChange={(e) => setEditing({ ...editing, zip: e.target.value })} /></div>
                  </div>
                </div>
              </section>

              <section>
                <SectionTitle>Notes</SectionTitle>
                <textarea className="input" rows={2} placeholder="Gift wrap preferences, sizing, anything worth remembering…"
                  value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </section>

              {editing.id && (
                <section>
                  <SectionTitle>
                    Orders{!ordersLoading && customerOrders.length ? ` · ${customerOrders.length}` : ""}
                  </SectionTitle>
                  {ordersLoading && (
                    <div className="space-y-1.5">
                      {[0, 1].map((i) => <div key={i} className="h-11 animate-pulse rounded-xl bg-sand/30" />)}
                    </div>
                  )}
                  {!ordersLoading && !customerOrders.length && (
                    <p className="rounded-xl border border-dashed border-sand px-4 py-4 text-center text-sm text-ink/50">
                      No orders found for this customer yet.
                    </p>
                  )}
                  {!ordersLoading && customerOrders.length > 0 && (
                    <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                      {customerOrders.map((o) => (
                        <a
                          key={o.id}
                          href={"/orders/" + o.id}
                          className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-sand bg-white px-3.5 py-2.5 text-sm transition-colors hover:border-taupe/40 hover:bg-sand/10"
                        >
                          <span className="font-medium tabular-nums">
                            {o.order_number != null ? "#EB-" + o.order_number : "#" + String(o.id).slice(0, 8).toUpperCase()}
                          </span>
                          <span className="truncate text-ink/55">
                            {new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {o.carrier ? " · " + o.carrier : ""}
                          </span>
                          <span className={`pill capitalize ${statusTone(o.status)}`}>{String(o.status || "").replace(/_/g, " ")}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex flex-wrap items-center gap-2 border-t border-sand/50 bg-cream px-6 py-4">
              {editing.id && (
                <button onClick={deleteCustomer} disabled={busy}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
                  Delete
                </button>
              )}
              {editing.id && editing.portal_token && (
                <button onClick={copyPortalLink} className="rounded-xl px-3 py-2 text-sm font-medium text-taupe hover:bg-sand/40">
                  {linkCopied ? "✓ Link copied" : "Copy portal link"}
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button onClick={closeEditor} className="btn-secondary">Cancel</button>
                <button onClick={save} disabled={busy} className="btn-primary">{busy ? "Saving…" : editing.id ? "Save changes" : "Add customer"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge modal */}
      {showMerge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]" onClick={() => { setShowMerge(false); setMergeGroup(null); }}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-cream shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-sand/50 px-6 py-4">
              {mergeGroup && (
                <button onClick={() => setMergeGroup(null)} aria-label="Back" className="rounded-lg p-1.5 text-ink/50 hover:bg-sand/40 hover:text-ink">
                  <span className="block rotate-180">{Icon.chevron}</span>
                </button>
              )}
              <div className="flex-1">
                <h2 className="text-2xl">{mergeGroup ? "Pick the main record" : "Merge duplicates"}</h2>
                <p className="text-sm text-ink/55">
                  {mergeGroup
                    ? "The others are archived and their orders move to the one you keep."
                    : `${dupes.length} possible duplicate group${dupes.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <button onClick={() => { setShowMerge(false); setMergeGroup(null); }} aria-label="Close" className="rounded-lg p-1.5 text-ink/50 hover:bg-sand/40 hover:text-ink">
                {Icon.close}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {!mergeGroup ? (
                <>
                  <p className="text-sm text-ink/65">
                    Matched by email, phone, name + ZIP, or address. Merged duplicates are archived — never deleted.
                  </p>
                  <div className="mt-4 space-y-2.5">
                    {dupes.map((g) => (
                      <button key={g.key} onClick={() => { setMergeGroup(g); setPrimaryId(g.customers[0].id); }}
                        className="group flex w-full items-center gap-4 rounded-xl border border-sand bg-white p-4 text-left transition-colors hover:border-taupe/40 hover:bg-sand/10">
                        <div className="flex -space-x-2">
                          {g.customers.slice(0, 3).map((c) => (
                            <span key={c.id} className="rounded-full ring-2 ring-white"><Avatar name={c.name} id={c.id} size="sm" /></span>
                          ))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{g.customers.map((c) => c.name).join("  ·  ")}</p>
                          <span className="pill mt-1 inline-block bg-amber-100 text-amber-800">{g.reason}</span>
                        </div>
                        <span className="text-ink/25 group-hover:text-taupe">{Icon.chevron}</span>
                      </button>
                    ))}
                    {!dupes.length && (
                      <div className="rounded-xl border border-dashed border-sand px-4 py-10 text-center">
                        <p className="font-medium">No duplicates detected</p>
                        <p className="mt-1 text-sm text-ink/55">Nice and tidy.</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  {mergeGroup.customers.map((c) => {
                    const selected = primaryId === c.id;
                    return (
                      <label key={c.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${selected ? "border-taupe bg-sand/20 ring-1 ring-taupe/30" : "border-sand bg-white hover:bg-sand/10"}`}>
                        <input type="radio" className="mt-3 accent-taupe" checked={selected} onChange={() => setPrimaryId(c.id)} />
                        <Avatar name={c.name} id={c.id} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 font-medium">
                            {c.name}
                            {selected && <span className="pill bg-taupe text-cream">Keep</span>}
                          </p>
                          <p className="text-sm text-ink/60">{[c.email, c.phone].filter(Boolean).join(" · ") || "No contact info"}</p>
                          <p className="text-sm text-ink/60">{[c.street1, c.city, c.state, c.zip].filter(Boolean).join(", ") || "No address"}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {mergeGroup && (
              <div className="flex justify-end gap-2 border-t border-sand/50 px-6 py-4">
                <button onClick={() => setMergeGroup(null)} className="btn-secondary">Back</button>
                <button onClick={merge} disabled={busy} className="btn-primary">
                  {busy ? "Merging…" : `Merge ${mergeGroup.customers.length - 1} into selected`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}