"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const empty = {
  code: "", name: "", street1: "", street2: "",
  city: "", state: "", zip: "", phone: "", email: "", reason: "",
};

export default function PublicReturnPage() {
  const [form, setForm] = useState({ ...empty });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/returns/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="card w-full max-w-md !rounded-[2rem] text-center">
          <Image src="/logo2.png" alt="Erendira's Boutique" width={120} height={52} className="mx-auto h-auto w-28" />
          <h1 className="mt-6 text-3xl">Request received</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink/70">
            Thanks, {form.name.split(" ")[0]}! We&apos;ve received your return request.
            Once your prepaid USPS label is ready, come back and print it with your return code:
          </p>
          <p className="mt-3 font-mono text-lg tracking-[0.25em] text-taupe">{form.code}</p>
          <Link href="/return/status" className="btn-primary mt-5 inline-flex">
            Check Return Status
          </Link>
          <p className="mt-4 text-xs text-ink/50">
            Questions? Contact us at hello@erendirasboutique.com
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-lg !rounded-[2rem]">
        <div className="text-center">
          <Image src="/logo2.png" alt="Erendira's Boutique" width={120} height={52} className="mx-auto h-auto w-28" />
          <h1 className="mt-5 text-3xl">Start a Return</h1>
          <p className="mt-2 text-sm text-ink/70">
            Enter the return code we gave you and the address you&apos;ll ship from.
          </p>
        </div>

        {error && (
          <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-6 grid gap-3">
          <div>
            <label className="label">Return code</label>
            <input
              className="input text-center font-mono uppercase tracking-[0.25em]"
              placeholder="EB-XXXXXX"
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="label">Full name</label>
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="label">Street address</label>
            <input className="input" value={form.street1} onChange={(e) => set("street1", e.target.value)} />
          </div>
          <div>
            <label className="label">Apt / Suite (optional)</label>
            <input className="input" value={form.street2} onChange={(e) => set("street2", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div>
              <label className="label">State</label>
              <input className="input" maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="label">ZIP</label>
              <input className="input" value={form.zip} onChange={(e) => set("zip", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <label className="label">Phone (optional)</label>
              <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Reason for return (optional)</label>
            <textarea className="input" rows={3} value={form.reason} onChange={(e) => set("reason", e.target.value)} />
          </div>
        </div>

        <button onClick={submit} disabled={busy} className="btn-primary mt-6 w-full !py-3">
          {busy ? "Submitting…" : "Submit Return Request"}
        </button>
        <p className="mt-4 text-center text-xs text-ink/50">
          After you submit, we&apos;ll review your request and send your prepaid return label.
        </p>
      </div>
    </div>
  );
}
