"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const emptyForm = {
  name: "", street1: "", street2: "",
  city: "", state: "", zip: "", phone: "", email: "", reason: "",
};

function Flower({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <ellipse cx="20" cy="11" rx="6" ry="9" fill="currentColor" />
      <ellipse cx="20" cy="11" rx="6" ry="9" fill="currentColor" transform="rotate(90 20 20)" />
      <ellipse cx="20" cy="11" rx="6" ry="9" fill="currentColor" transform="rotate(180 20 20)" />
      <ellipse cx="20" cy="11" rx="6" ry="9" fill="currentColor" transform="rotate(270 20 20)" />
      <circle cx="20" cy="20" r="4" fill="currentColor" />
    </svg>
  );
}

export default function PublicReturnPage() {
  const [stage, setStage] = useState<"code" | "form" | "done">("code");
  const [code, setCode] = useState("");
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyUsed, setAlreadyUsed] = useState(false);

  function set(key: string, value: string) {
    setForm(function (f) {
      return { ...f, [key]: value };
    });
  }

  async function unlock() {
    const c = code.trim().toUpperCase();
    if (!c) {
      setError("Enter your return access code.");
      return;
    }
    setError(null);
    setAlreadyUsed(false);
    setBusy(true);
    try {
      const res = await fetch("/api/returns/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        throw new Error(data.error || "That return code wasn't found.");
      }
      if (data.state === "submitted" || data.state === "label_ready" || data.used) {
        setAlreadyUsed(true);
        return;
      }
      setStage("form");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/returns/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, code: code.trim().toUpperCase() }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      setStage("done");
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] px-4 py-10">
      {/* background flowers */}
      <Flower className="pointer-events-none absolute -left-8 top-40 w-32 text-sand/30" />
      <Flower className="pointer-events-none absolute -right-6 -top-6 w-24 text-sand/25" />
      <Flower className="pointer-events-none absolute -bottom-8 right-24 w-36 text-sand/25" />
      <Flower className="pointer-events-none absolute bottom-24 -right-10 w-24 text-sand/20" />

      <div className="relative mx-auto w-full max-w-3xl">
        {/* Header card */}
        <div className="card flex flex-wrap items-center gap-6 !rounded-[1.75rem] border-l-[6px] !border-l-taupe !p-8">
          <Image
            src="/logo2.png"
            alt="Erendira&apos;s Boutique"
            width={190}
            height={82}
            className="h-auto w-40"
            priority
          />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Returns portal</p>
            <h1 className="mt-1 font-body text-4xl font-semibold !text-taupe sm:text-5xl">
              Start Your Return
            </h1>
            <p className="mt-2 text-sm text-ink/70">
              Enter the return access code provided by Erendira&apos;s Boutique.
            </p>
          </div>
        </div>

        {/* Body card */}
        <div className="card mt-6 !rounded-[1.75rem] !p-8">
          {stage === "code" && (
            <>
              <p className="eyebrow">Return access</p>
              <h2 className="mt-1 font-body text-2xl font-semibold !text-taupe">
                Enter your return code
              </h2>
              <p className="mt-1 text-sm text-ink/70">
                Use the access code provided by Erendira&apos;s Boutique to start your return request.
              </p>

              {error && (
                <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              )}
              {alreadyUsed && (
                <div className="mt-5 rounded-2xl border border-taupe/30 bg-cream px-4 py-4 text-sm text-ink/80">
                  This code has already been used to start a return.{" "}
                  <Link href="/return/status" className="font-medium text-taupe underline underline-offset-2">
                    Check your return status
                  </Link>{" "}
                  to see or print your label.
                </div>
              )}

              <div className="mt-6">
                <label className="label">Access code</label>
                <input
                  className="input !py-3.5 font-mono uppercase tracking-[0.2em]"
                  placeholder="Example: EB-XXXXXX"
                  value={code}
                  onChange={function (e) {
                    setCode(e.target.value.toUpperCase());
                  }}
                  onKeyDown={function (e) {
                    if (e.key === "Enter") unlock();
                  }}
                />
              </div>

              <button onClick={unlock} disabled={busy} className="btn-primary mt-5 w-full !py-4 !text-sm">
                {busy ? "Checking..." : "Unlock Return Form"}
              </button>

              <p className="mt-5 text-center text-xs text-ink/60">
                Already submitted a return?{" "}
                <Link href="/return/status" className="text-taupe underline underline-offset-2">
                  Check your return status
                </Link>
              </p>
            </>
          )}

          {stage === "form" && (
            <>
              <p className="eyebrow">Return access</p>
              <h2 className="mt-1 font-body text-2xl font-semibold !text-taupe">
                Where are you shipping from?
              </h2>
              <p className="mt-1 text-sm text-ink/70">
                Code <span className="font-mono tracking-widest text-taupe">{code}</span> accepted.
                Fill in your pickup address and we&apos;ll prepare your prepaid USPS label.
              </p>

              {error && (
                <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              )}

              <div className="mt-6 grid gap-3">
                <div>
                  <label className="label">Full name</label>
                  <input className="input" value={form.name} onChange={function (e) { set("name", e.target.value); }} />
                </div>
                <div>
                  <label className="label">Street address</label>
                  <input className="input" value={form.street1} onChange={function (e) { set("street1", e.target.value); }} />
                </div>
                <div>
                  <label className="label">Apt / Suite (optional)</label>
                  <input className="input" value={form.street2} onChange={function (e) { set("street2", e.target.value); }} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">City</label>
                    <input className="input" value={form.city} onChange={function (e) { set("city", e.target.value); }} />
                  </div>
                  <div>
                    <label className="label">State</label>
                    <input className="input" maxLength={2} value={form.state} onChange={function (e) { set("state", e.target.value.toUpperCase()); }} />
                  </div>
                  <div>
                    <label className="label">ZIP</label>
                    <input className="input" value={form.zip} onChange={function (e) { set("zip", e.target.value); }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Email</label>
                    <input className="input" value={form.email} onChange={function (e) { set("email", e.target.value); }} />
                  </div>
                  <div>
                    <label className="label">Phone (optional)</label>
                    <input className="input" value={form.phone} onChange={function (e) { set("phone", e.target.value); }} />
                  </div>
                </div>
                <div>
                  <label className="label">Reason for return (optional)</label>
                  <textarea className="input" rows={3} value={form.reason} onChange={function (e) { set("reason", e.target.value); }} />
                </div>
              </div>

              <button onClick={submit} disabled={busy} className="btn-primary mt-6 w-full !py-4 !text-sm">
                {busy ? "Submitting..." : "Submit Return Request"}
              </button>
              <button
                onClick={function () { setStage("code"); setError(null); }}
                className="mt-3 w-full text-center text-xs text-ink/60 underline underline-offset-2"
              >
                Use a different code
              </button>
            </>
          )}

          {stage === "done" && (
            <div className="text-center">
              <p className="eyebrow">Return access</p>
              <h2 className="mt-1 font-body text-3xl font-semibold !text-taupe">Request received</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink/70">
                Thanks, {form.name.split(" ")[0]}! We&apos;ve received your return request.
                Once your prepaid USPS label is ready, come back and print it with your return code:
              </p>
              <p className="mt-3 font-mono text-lg tracking-[0.25em] text-taupe">{code}</p>
              <Link href="/return/status" className="btn-primary mt-5 inline-flex">
                Check Return Status
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-taupe/30 pt-5 text-center">
          <p className="text-sm font-medium text-ink/80">
            Erendira&apos;s Boutique &middot; Returns Portal
          </p>
          <p className="mt-1 text-xs text-ink/60">
            For questions, please contact us through our boutique support channels.
          </p>
        </div>
      </div>
    </div>
  );
}
