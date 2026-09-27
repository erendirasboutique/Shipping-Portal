"use client";

// Pop-up for checking in a returned package: condition, notes, photo.

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

export type ReturnRequest = {
  id: string;
  return_code: string | null;
  order_label?: string | null;
  from_name: string | null;
  from_city: string | null;
  from_state: string | null;
  reason: string | null;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
  received_at: string | null;
  received_by: string | null;
  receive_condition: string | null;
  receive_notes: string | null;
  receive_photo_url: string | null;
};

export const CONDITIONS: { id: string; label: string }[] = [
  { id: "like_new", label: "Like new" },
  { id: "worn", label: "Worn / used" },
  { id: "damaged", label: "Damaged" },
  { id: "missing_items", label: "Missing items" },
  { id: "wrong_item", label: "Wrong item" },
];

export function conditionLabel(id: string | null) {
  return CONDITIONS.find((c) => c.id === id)?.label || id || "";
}

async function compress(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new window.Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("decode"));
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b || file), "image/jpeg", 0.82));
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ReceiveReturn({
  request,
  onClose,
  onSaved,
}: {
  request: ReturnRequest;
  onClose: () => void;
  onSaved: (updated: ReturnRequest) => void;
}) {
  const [condition, setCondition] = useState<string>(request.receive_condition || "");
  const [notes, setNotes] = useState(request.receive_notes || "");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const already = !!request.received_at;

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const b = await compress(f);
    setPhoto(b);
    setPreview(URL.createObjectURL(b));
  }

  async function save() {
    if (!condition) {
      setErr("Pick the item's condition.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("requestId", request.id);
      fd.append("condition", condition);
      fd.append("notes", notes);
      if (photo) fd.append("photo", photo, "return.jpg");
      const res = await fetch("/api/returns/receive", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save.");
      onSaved({ ...request, ...data.request });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const photoSrc = preview || request.receive_photo_url;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-3 sm:items-center" onClick={() => !busy && onClose()}>
      <div className="card max-h-[92vh] w-full max-w-md overflow-y-auto !rounded-[2rem] !p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Receive return</p>
            <p className="mt-1 truncate font-heading text-3xl text-taupe">{request.from_name || "Customer"}</p>
            <p className="text-sm text-ink/60">
              {[request.from_city, request.from_state].filter(Boolean).join(", ")}
              {request.order_label ? " · " + request.order_label : ""}
              {request.return_code ? " · " + request.return_code : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full px-3 py-1 text-xl leading-none text-taupe hover:bg-taupe/10">×</button>
        </div>

        {request.reason && (
          <div className="mt-4 rounded-2xl bg-cream/70 px-4 py-3 text-sm dark:bg-transparent dark:ring-1 dark:ring-taupe/20">
            <p className="label">Customer&apos;s reason</p>
            <p>{request.reason}</p>
          </div>
        )}

        {already && (
          <p className="mt-3 rounded-2xl bg-[#fbf1dc] px-4 py-2.5 text-xs text-[#7a5a1e] dark:bg-transparent dark:text-[#e6c88f]">
            Already received {new Date(request.received_at as string).toLocaleString()}
            {request.received_by ? " by " + request.received_by.split("@")[0] : ""}. Saving again updates it.
          </p>
        )}

        <p className="label mt-5">Condition</p>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCondition(c.id)}
              className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
                condition === c.id ? "border-taupe bg-taupe text-cream dark:text-[#26211b]" : "border-taupe/30 text-taupe hover:bg-taupe/10"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <p className="label mt-5">Photo of the item</p>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
        {photoSrc ? (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoSrc} alt="Returned item" className="w-full rounded-[1.5rem] object-cover" style={{ maxHeight: 320 }} />
            <button onClick={() => fileRef.current?.click()} className="btn-secondary mt-2 w-full">Retake photo</button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-[1.5rem] border-2 border-dashed border-taupe/40 bg-cream/60 py-8 text-taupe dark:bg-transparent"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            <span className="text-sm">Take photo (optional)</span>
          </button>
        )}

        <p className="label mt-5">Notes</p>
        <textarea
          className="input"
          rows={2}
          placeholder="Tags still on, small stain on sleeve…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {err && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{err}</p>}

        <button onClick={save} disabled={busy} className="btn-primary mt-5 w-full !py-3.5 !text-base">
          {busy ? "Saving…" : already ? "Update" : "Mark received"}
        </button>
      </div>
    </div>
  );
}
