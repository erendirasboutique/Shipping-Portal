"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import BarcodeScanner from "@/components/BarcodeScanner";
import ReceiveReturn, { conditionLabel } from "@/components/ReceiveReturn";
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

type RateOption = {
  id: string;
  carrier: string;
  service: string;
  rate: string | number;
  days?: number;
};

export default function ReturnsPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [requests, setRequests] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);

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

  function ReceivedInfo({ rr }: { rr: any }) {
    if (!rr.received_at) return null;
    return (
      <div className="mt-1.5 flex items-center gap-2 text-xs text-ink/60">
        {rr.receive_photo_url && (
          <a href={rr.receive_photo_url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={rr.receive_photo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
          </a>
        )}
        <span>
          {conditionLabel(rr.receive_condition)} · {new Date(rr.received_at).toLocaleDateString()}
        </span>
      </div>
    );
  }

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

  function RequestActions({ rr, mobile = false }: { rr: any; mobile?: boolean }) {
    const size = mobile ? "!px-4 !py-2.5 !text-sm flex-1 text-center" : "!px-3 !py-1.5 !text-xs";
    return (
      <div className={mobile ? "flex flex-wrap gap-2" : "flex flex-wrap gap-1.5"}>
        {rr.status === "submitted" && (
          <button onClick={() => openRates(rr)} disabled={busy !== null} className={`btn-primary ${size}`}>
            {busy === rr.id ? "Getting rates…" : "Create label"}
          </button>
        )}
        {rr.label_url && (
          <button onClick={() => printLabel(rr)} disabled={busy !== null} className={`btn-secondary ${size}`}>
            {busy === `print-${rr.id}` ? "Opening…" : "Print label"}
          </button>
        )}
        {rr.tracking_url && (
          <a href={rr.tracking_url} target="_blank" rel="noreferrer" className={`btn-secondary ${size}`}>Track</a>
        )}
        {(rr.tracking_number || rr.received_at) && (
          <button onClick={() => setReceiving(rr)} disabled={busy !== null} className={`btn-secondary ${size}`}>
            {rr.received_at ? "Received ✓" : "Receive"}
          </button>
        )}
      </div>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl">Returns ↩️</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a href="/return-instructions-half.pdf" target="_blank" rel="noreferrer" className="btn-secondary text-center">
            Instructions · Half Page
          </a>
          <a href="/return-instructions-full.pdf" target="_blank" rel="noreferrer" className="btn-secondary text-center">
            Instructions · Full Page
          </a>
          <button onClick={() => setScanning(true)} className="btn-secondary inline-flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" />
              <path d="M8 9v6M11 9v6M14 9v6M16.5 9v6" />
            </svg>
            Scan return
          </button>
          <button onClick={generateCode} disabled={busy === "code"} className="btn-primary">
            {busy === "code" ? "Generating…" : "Generate return code"}
          </button>
        </div>
      </div>

      {msg && <p className="mt-4 cursor-pointer rounded-xl bg-sand/30 px-4 py-3 text-sm text-taupe" onClick={() => setMsg(null)}>{msg}</p>}

      {newCode && (
        <div className="card mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="label">New return access code</p>
            <p className="break-all font-mono text-xl tracking-widest text-taupe sm:text-2xl">{newCode}</p>
          </div>
          <button className="btn-secondary" onClick={() => { navigator.clipboard.writeText(newCode); setMsg("Code copied."); }}>
            Copy code
          </button>
        </div>
      )}

      <h2 className="mt-8 text-xl">Return requests</h2>

      {/* Mobile: stacked cards */}
      <div className="mt-3 space-y-3 md:hidden">
        {requests.map((rr) => (
          <div key={rr.id} className="card space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{rr.from_name || "—"}</p>
                <p className="text-xs text-ink/60">{[rr.from_city, rr.from_state].filter(Boolean).join(", ")}</p>
              </div>
              <div className="flex flex-col items-end">
                <StatusPill status={rr.status} />
                <ReceivedInfo rr={rr} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <p className="label">Code</p>
                <p className="font-mono text-xs">{rr.return_code || "—"}</p>
              </div>
              <div>
                <p className="label">Tracking</p>
                <p className="break-all font-mono text-xs">{rr.tracking_number || "—"}</p>
              </div>
              {rr.reason && (
                <div className="col-span-2">
                  <p className="label">Reason</p>
                  <p className="text-sm">{rr.reason}</p>
                </div>
              )}
            </div>
            {(rr.status === "submitted" || rr.label_url || rr.tracking_url || rr.tracking_number) && <RequestActions rr={rr} mobile />}
          </div>
        ))}
        {!requests.length && (
          <div className="card py-10 text-center text-ink/50">No return requests yet.</div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="card mt-3 hidden overflow-x-auto !p-0 md:block">
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
                <td className="table-td">
                  <StatusPill status={rr.status} />
                  <ReceivedInfo rr={rr} />
                </td>
                <td className="table-td font-mono text-xs">{rr.tracking_number || "—"}</td>
                <td className="table-td">
                  <RequestActions rr={rr} />
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

      {/* Mobile: stacked cards */}
      <div className="mt-3 space-y-3 md:hidden">
        {codes.map((c) => (
          <div key={c.id} className="card flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="break-all font-mono">{c.code}</p>
              <p className="mt-1 text-xs text-ink/60">
                {new Date(c.created_at).toLocaleDateString()}
                {c.created_by ? ` · ${c.created_by}` : ""}
              </p>
            </div>
            <span className={`pill shrink-0 ${c.used ? "bg-sand/40 text-taupe" : "bg-emerald-100 text-emerald-800"}`}>
              {c.used ? "used" : "active"}
            </span>
          </div>
        ))}
        {!codes.length && (
          <div className="card py-8 text-center text-ink/50">No codes generated yet.</div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="card mt-3 hidden overflow-x-auto !p-0 md:block">
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
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
