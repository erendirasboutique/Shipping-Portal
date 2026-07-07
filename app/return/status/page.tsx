"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function ReturnStatusPage() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<any | null>(null);
  const [opening, setOpening] = useState(false);

  async function lookup() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/returns/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      setInfo(data);
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  }

  async function printLabel() {
    if (!info?.label_url) return;
    setOpening(true);
    try {
      const res = await fetch(info.label_url);
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch {
      window.open(info.label_url, "_blank");
    }
    setOpening(false);
  }

  const uspsMapUrl = info?.zip
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`USPS near ${info.zip}`)}`
    : "https://www.google.com/maps/search/?api=1&query=USPS";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-lg !rounded-[2rem]">
        <div className="text-center">
          <Image src="/logo2.png" alt="Erendira's Boutique" width={120} height={52} className="mx-auto h-auto w-28" />
          <h1 className="mt-5 text-3xl">Your Return</h1>
          <p className="mt-2 text-sm text-ink/70">
            Enter your return code to check status and print your label.
          </p>
        </div>

        <div className="mt-6 flex gap-2">
          <input
            className="input text-center font-mono uppercase tracking-[0.25em]"
            placeholder="EB-XXXXXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
          <button onClick={lookup} disabled={busy || !code.trim()} className="btn-primary shrink-0">
            {busy ? "Checking…" : "Check"}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {info?.state === "no_request" && (
          <div className="mt-6 rounded-2xl border border-taupe/20 bg-cream/60 p-5 text-center">
            <p className="text-sm text-ink/80">
              This code hasn&apos;t been used to start a return yet.
            </p>
            <Link href="/return" className="btn-primary mt-4 inline-flex">
              Start your return
            </Link>
          </div>
        )}

        {info?.state === "submitted" && (
          <div className="mt-6 rounded-2xl border border-taupe/20 bg-cream/60 p-5 text-center">
            <span className="pill">In review</span>
            <p className="mt-3 text-sm leading-relaxed text-ink/80">
              {info.first_name ? `Thanks, ${info.first_name}! ` : ""}Your return request is in.
              We&apos;re preparing your prepaid USPS label — check back here soon with this same code to print it.
            </p>
          </div>
        )}

        {info?.state === "label_ready" && (
          <div className="mt-6">
            <div className="rounded-2xl border border-taupe/20 bg-cream/60 p-5 text-center">
              <span className="pill">Label ready</span>
              <p className="mt-3 text-sm text-ink/80">
                {info.first_name ? `${info.first_name}, your` : "Your"} prepaid{" "}
                {info.carrier || "USPS"} return label is ready.
              </p>
              {info.tracking_number && (
                <p className="mt-2 font-mono text-xs text-ink/60">{info.tracking_number}</p>
              )}
              <button onClick={printLabel} disabled={opening} className="btn-primary mt-4 w-full !py-3">
                {opening ? "Opening…" : "Print Return Label"}
              </button>
              {info.tracking_url && (
                <a href={info.tracking_url} target="_blank" rel="noreferrer" className="btn-secondary mt-2 w-full">
                  Track Return
                </a>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <a href="/return-instructions-half.pdf" target="_blank" rel="noreferrer" className="btn-secondary w-full !text-xs">
                Instructions
              </a>
              <a href="/return-instructions-full.pdf" target="_blank" rel="noreferrer" className="btn-secondary w-full !text-xs">
                Full-Page Guide
              </a>
              <a href={uspsMapUrl} target="_blank" rel="noreferrer" className="btn-secondary w-full !text-xs">
                Nearest USPS
              </a>
            </div>

            <p className="mt-4 text-center text-xs leading-relaxed text-ink/50">
              Print the label, attach it to your package, and drop it off at any USPS location
              or hand it to your mail carrier.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
