"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";

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

export default function CustomersPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any | null>(null); // customer object or {...empty} for new
  const [showMerge, setShowMerge] = useState(false);
  const [mergeGroup, setMergeGroup] = useState<DupeGroup | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("shipping_customers")
      .select("*")
      .eq("archived", false)
      .order("name");
    setCustomers(data ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = customers.filter((c) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return [c.name, c.email, c.phone, c.city, c.zip].some((v) => (v || "").toLowerCase().includes(s));
  });

  const dupes = useMemo(() => findDuplicates(customers), [customers]);

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

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Customers</h1>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} className="btn-secondary">Import CSV</button>
          <button onClick={() => setShowMerge(true)} className="btn-secondary">
            Find duplicates{dupes.length ? ` (${dupes.length})` : ""}
          </button>
          <button onClick={() => setEditing({ ...empty })} className="btn-primary">Add customer</button>
        </div>
      </div>

      {msg && <p className="mt-4 cursor-pointer rounded-xl bg-sand/30 px-4 py-3 text-sm text-taupe" onClick={() => setMsg(null)}>{msg}</p>}

      <input className="input mt-6 max-w-md" placeholder="Search customers…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card mt-4 overflow-x-auto !p-0">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-sand/60">
            <tr>
              <th className="table-th">Name</th>
              <th className="table-th">Email</th>
              <th className="table-th">Phone</th>
              <th className="table-th">City</th>
              <th className="table-th">ZIP</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} onClick={() => setEditing(c)} className="cursor-pointer border-b border-sand/30 last:border-0 hover:bg-sand/15">
                <td className="table-td font-medium">{c.name}</td>
                <td className="table-td">{c.email || "—"}</td>
                <td className="table-td">{c.phone || "—"}</td>
                <td className="table-td">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                <td className="table-td">{c.zip || "—"}</td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={5} className="table-td py-10 text-center text-ink/50">No customers yet. Add one or import a CSV.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => { setEditing(null); setLinkCopied(false); }}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-cream p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl">{editing.id ? "Edit customer" : "Add customer"}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="label">Name</label>
                <input className="input" value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><label className="label">Email</label>
                <input className="input" value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
              <div><label className="label">Phone</label>
                <input className="input" value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="label">Street</label>
                <input className="input" value={editing.street1 || ""} onChange={(e) => setEditing({ ...editing, street1: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="label">Apt / Suite</label>
                <input className="input" value={editing.street2 || ""} onChange={(e) => setEditing({ ...editing, street2: e.target.value })} /></div>
              <div><label className="label">City</label>
                <input className="input" value={editing.city || ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">State</label>
                  <input className="input" maxLength={2} value={editing.state || ""} onChange={(e) => setEditing({ ...editing, state: e.target.value.toUpperCase() })} /></div>
                <div><label className="label">ZIP</label>
                  <input className="input" value={editing.zip || ""} onChange={(e) => setEditing({ ...editing, zip: e.target.value })} /></div>
              </div>
              <div className="sm:col-span-2"><label className="label">Notes</label>
                <textarea className="input" rows={2} value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button onClick={save} disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save customer"}</button>
              <button onClick={() => { setEditing(null); setLinkCopied(false); }} className="btn-secondary">Cancel</button>
              {editing.id && editing.portal_token && (
                <button onClick={copyPortalLink} className="btn-secondary ml-auto">
                  {linkCopied ? "Copied!" : "Copy portal link"}
                </button>
              )}
              {editing.id && (
                <button onClick={deleteCustomer} disabled={busy} className={`btn-secondary border-red-400/50 text-red-700 hover:bg-red-50 ${editing.portal_token ? "" : "ml-auto"}`}>
                  {busy ? "…" : "Delete"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Merge modal */}
      {showMerge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => { setShowMerge(false); setMergeGroup(null); }}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-cream p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl">Merge duplicates</h2>
            {!mergeGroup ? (
              <>
                <p className="mt-2 text-sm text-ink/70">
                  Possible duplicates found by matching email, phone, name + ZIP, or address.
                  Merged duplicates are archived — never deleted — and their orders move to the main customer.
                </p>
                <div className="mt-4 space-y-3">
                  {dupes.map((g) => (
                    <button key={g.key} onClick={() => { setMergeGroup(g); setPrimaryId(g.customers[0].id); }}
                      className="block w-full rounded-xl border border-sand bg-white p-4 text-left hover:bg-sand/20">
                      <p className="pill bg-sand/40 text-taupe">{g.reason}</p>
                      <p className="mt-2 text-sm">{g.customers.map((c) => c.name).join("  ·  ")}</p>
                    </button>
                  ))}
                  {!dupes.length && <p className="text-sm text-ink/60">No duplicates detected. Nice and tidy.</p>}
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-ink/70">Choose which record to keep as the main customer:</p>
                <div className="mt-4 space-y-2">
                  {mergeGroup.customers.map((c) => (
                    <label key={c.id} className={`block cursor-pointer rounded-xl border p-4 ${primaryId === c.id ? "border-taupe bg-sand/20" : "border-sand bg-white"}`}>
                      <input type="radio" className="mr-2 accent-taupe" checked={primaryId === c.id} onChange={() => setPrimaryId(c.id)} />
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-2 text-sm text-ink/60">
                        {[c.email, c.phone, [c.street1, c.city, c.state, c.zip].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-5 flex gap-2">
                  <button onClick={merge} disabled={busy} className="btn-primary">
                    {busy ? "Merging…" : "Merge into selected"}
                  </button>
                  <button onClick={() => setMergeGroup(null)} className="btn-secondary">Back</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}
