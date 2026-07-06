"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { supabaseBrowser } from "@/lib/supabase/client";

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    submitted: "bg-amber-100 text-amber-800",
    label_created: "bg-emerald-100 text-emerald-800",
    received: "bg-sand/40 text-taupe",
    closed: "bg-sand/40 text-taupe",
  };
  return <span className={`pill ${styles[status] || "bg-sand/40 text-taupe"}`}>{status.replace("_", " ")}</span>;
}

export default function ReturnsPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [requests, setRequests] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);

  async function load() {
    const [{ data: reqs }, { data: cds }] = await Promise.all([
      supabase.from("return_requests").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("return_codes").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setRequests(reqs ?? []);
    setCodes(cds ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function createLabel(rr: any) {
    setBusy(rr.id);
    const res = await fetch("/api/returns/label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: rr.id }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) return setMsg(data.error);
    setMsg(`USPS return label created — ${data.tracking_number}`);
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

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Returns</h1>
        <div className="flex flex-wrap gap-2">
          <a href="/return-instructions-half.pdf" target="_blank" rel="noreferrer" className="btn-secondary">
            Instructions · Half Page
          </a>
          <a href="/return-instructions-full.pdf" target="_blank" rel="noreferrer" className="btn-secondary">
            Instructions · Full Page
          </a>
          <button onClick={generateCode} disabled={busy === "code"} className="btn-primary">
            {busy === "code" ? "Generating…" : "Generate return code"}
          </button>
        </div>
      </div>

      {msg && <p className="mt-4 cursor-pointer rounded-xl bg-sand/30 px-4 py-3 text-sm text-taupe" onClick={() => setMsg(null)}>{msg}</p>}

      {newCode && (
        <div className="card mt-4 flex items-center justify-between">
          <div>
            <p className="label">New return access code</p>
            <p className="font-mono text-2xl tracking-widest text-taupe">{newCode}</p>
          </div>
          <button className="btn-secondary" onClick={() => { navigator.clipboard.writeText(newCode); setMsg("Code copied."); }}>
            Copy code
          </button>
        </div>
      )}

      <h2 className="mt-8 text-xl">Return requests</h2>
      <div className="card mt-3 overflow-x-auto !p-0">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-sand/60">
            <tr>
              <th className="table-th">Customer</th>
              <th className="table-th">Code</th>
              <th className="table-th">Reason</th>
              <th className="table-th">Status</th>
              <th className="table-th">Tracking</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((rr) => (
              <tr key={rr.id} className="border-b border-sand/30 last:border-0">
                <td className="table-td">
                  <p className="font-medium">{rr.from_name || "—"}</p>
                  <p className="text-xs text-ink/60">{[rr.from_city, rr.from_state].filter(Boolean).join(", ")}</p>
                </td>
                <td className="table-td font-mono text-xs">{rr.return_code || "—"}</td>
                <td className="table-td max-w-[200px] truncate">{rr.reason || "—"}</td>
                <td className="table-td"><StatusPill status={rr.status} /></td>
                <td className="table-td font-mono text-xs">{rr.tracking_number || "—"}</td>
                <td className="table-td">
                  <div className="flex flex-wrap gap-1.5">
                    {rr.status === "submitted" && (
                      <button onClick={() => createLabel(rr)} disabled={busy !== null} className="btn-primary !px-3 !py-1.5 !text-xs">
                        {busy === rr.id ? "Creating…" : "Create USPS label"}
                      </button>
                    )}
                    {rr.label_url && (
                      <button onClick={() => printLabel(rr)} disabled={busy !== null} className="btn-secondary !px-3 !py-1.5 !text-xs">
                        {busy === `print-${rr.id}` ? "Opening…" : "Print label"}
                      </button>
                    )}
                    {rr.tracking_url && (
                      <a href={rr.tracking_url} target="_blank" rel="noreferrer" className="btn-secondary !px-3 !py-1.5 !text-xs">Track</a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!requests.length && (
              <tr><td colSpan={6} className="table-td py-10 text-center text-ink/50">No return requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-xl">Recent access codes</h2>
      <div className="card mt-3 overflow-x-auto !p-0">
        <table className="w-full min-w-[520px]">
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
                <td className="table-td font-mono">{c.code}</td>
                <td className="table-td">
                  <span className={`pill ${c.used ? "bg-sand/40 text-taupe" : "bg-emerald-100 text-emerald-800"}`}>
                    {c.used ? "used" : "active"}
                  </span>
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
    </Shell>
  );
}
