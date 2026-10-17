"use client";

// Team — invite employees, see who has signed in, change roles, remove access.
// Admins only. Invites are one-time links you text or email to the person;
// tapping it signs them in and takes them to /welcome to pick a password.

import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";

type Person = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  active: boolean | null;
  phone: string | null;
  invited_at: string | null;
  invited_by: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

type Gate = { error: string; needsSetup?: boolean; canClaim?: boolean; me?: string | null };

type LinkResult = { link: string; name: string; email: string; phone: string };

function ago(iso: string | null): string {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function inviteMessage(r: LinkResult) {
  const first = (r.name || "").split(" ")[0];
  return (
    `Hi${first ? " " + first : ""}! Here's your invite to the Erendira's Boutique shipping portal. Tap it to get started:\n` +
    `¡Hola${first ? " " + first : ""}! Aquí está tu invitación al portal de envíos de Erendira's Boutique. Tócalo para empezar:\n\n` +
    r.link
  );
}

export default function TeamPage() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [me, setMe] = useState<string>("");
  const [gate, setGate] = useState<Gate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<LinkResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/team", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.status === 403) {
      setGate(json as Gate);
      return;
    }
    if (!res.ok) {
      setLoadError(json.error || "Couldn't load the team.");
      return;
    }
    setGate(null);
    setMe(json.me || "");
    setPeople(json.staff as Person[]);
  }, []);

  useEffect(() => {
    load();
    setCanShare(typeof navigator.share === "function");
  }, [load]);

  async function claim() {
    setBusy("claim");
    const res = await fetch("/api/team/claim", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setLoadError(json.error || "Couldn't set you up as admin.");
      return;
    }
    load();
  }

  async function invite() {
    setFormError(null);
    setBusy("invite");
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: name, email, phone, role }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setFormError(json.error || "Couldn't make the invite.");
      return;
    }
    setResult({ link: json.link, name, email: email.trim().toLowerCase(), phone });
    setCopied(false);
    setName("");
    setEmail("");
    setPhone("");
    setRole("staff");
    load();
  }

  async function newLink(p: Person) {
    setBusy("link:" + p.id);
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link", id: p.id }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      alert(json.error || "Couldn't make a link.");
      return;
    }
    setResult({ link: json.link, name: p.full_name || "", email: p.email, phone: p.phone || "" });
    setCopied(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    load();
  }

  async function update(p: Person, changes: { role?: string; active?: boolean }, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy("edit:" + p.id);
    const res = await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, ...changes }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      alert(json.error || "Couldn't save that.");
      return;
    }
    load();
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(inviteMessage(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy this:", inviteMessage(result));
    }
  }

  async function share() {
    if (!result) return;
    try {
      await navigator.share({ text: inviteMessage(result) });
    } catch {}
  }


  // ---------- not an admin ----------
  if (gate) {
    return (
      <Shell>
        <div className="mx-auto max-w-xl">
          <h1 className="mt-1 text-4xl">Team</h1>
          <div className="card mt-6">
            {gate.needsSetup && gate.canClaim ? (
              <>
                <h2 className="text-xl">Set up your Team page</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink/70">
                  No admin is set up yet. Make <b>{gate.me}</b> the admin so you can invite employees. Once an admin
                  exists, only people on this list can sign in with Google or an invite link.
                </p>
                <button onClick={claim} disabled={busy === "claim"} className="btn-primary mt-5">
                  {busy === "claim" ? "Setting up…" : "Make me the admin"}
                </button>
              </>
            ) : gate.needsSetup ? (
              <p className="text-sm leading-relaxed text-ink/70">
                No admin is set up yet. Sign out, then sign in with <b>your own email or Google</b> (not the shared
                access code) to set up the Team page.
              </p>
            ) : (
              <p className="text-sm text-ink/70">Only admins can manage the team.</p>
            )}
            {loadError && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{loadError}</p>}
          </div>
        </div>
      </Shell>
    );
  }

  const active = (people ?? []).filter((p) => p.active !== false);
  const removed = (people ?? []).filter((p) => p.active === false);

  return (
    <Shell>
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-taupe">Manage</p>
        <h1 className="mt-1 text-4xl md:text-5xl">Team</h1>
        <p className="mt-2 max-w-2xl text-ink/70">
          Invite employees with a one-time link. They tap it, pick a password, and land on their start page (
          <span className="font-mono text-sm">/e</span>).
        </p>

        {/* The link that was just made */}
        {result && (
          <div className="card mt-6 border-taupe/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl">Invite ready{result.name ? ` for ${result.name.split(" ")[0]}` : ""}</h2>
                <p className="mt-1 text-sm text-ink/70">
                  The link works for 7 days. Making a new one cancels the old one, so if you need to resend, tap{" "}
                  <b>New link</b> on their row.
                </p>
              </div>
              <button onClick={() => setResult(null)} aria-label="Close" className="text-ink/50 hover:text-ink">
                ✕
              </button>
            </div>
            <div className="mt-4 break-all rounded-2xl bg-sand/20 px-4 py-3 font-mono text-xs text-ink/80">{result.link}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={copy} className="btn-primary">
                {copied ? "Copied ✓" : "Copy invite"}
              </button>
              {canShare && (
                <button onClick={share} className="btn-secondary">
                  Share…
                </button>
              )}
              <a
                href={`sms:${result.phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(inviteMessage(result))}`}
                className="btn-secondary"
              >
                Text it
              </a>
              <a
                href={`mailto:${result.email}?subject=${encodeURIComponent(
                  "Your Erendira's Boutique portal invite"
                )}&body=${encodeURIComponent(inviteMessage(result))}`}
                className="btn-secondary"
              >
                Email it
              </a>
            </div>
            <p className="mt-3 text-xs text-ink/55">The message is in English and Spanish.</p>
          </div>
        )}

        {/* Invite form */}
        <div className="card mt-6">
          <h2 className="text-xl">Invite someone</h2>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              invite();
            }}
          >
            <label className="grid gap-1.5 text-sm">
              <span className="text-ink/70">Name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Lopez" />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-ink/70">Email (this is how they&apos;ll sign in)</span>
              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maria@gmail.com"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-ink/70">Phone (optional, for texting the invite)</span>
              <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(909) 555-0123" />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-ink/70">Access</span>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "staff")}>
                <option value="staff">Employee: uses the portal</option>
                <option value="admin">Admin: can also manage the team</option>
              </select>
            </label>
            {formError && (
              <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700 sm:col-span-2">{formError}</p>
            )}
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy === "invite" || !email.trim()} className="btn-primary">
                {busy === "invite" ? "Making link…" : "Create invite link"}
              </button>
            </div>
          </form>
        </div>

        {/* People */}
        <div className="card mt-6 !p-0">
          <div className="flex items-center justify-between px-6 pb-3 pt-6">
            <h2 className="text-xl">People</h2>
            <span className="text-sm text-ink/60">{active.length} with access</span>
          </div>
          {loadError && <p className="mx-6 mb-4 rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{loadError}</p>}
          {!people ? (
            <p className="px-6 pb-6 text-sm text-ink/60">Loading…</p>
          ) : (
            <ul className="divide-y divide-sand/50 border-t border-sand/50">
              {[...active, ...removed].map((p) => {
                const isMe = p.email === me;
                const off = p.active === false;
                const isAdmin = p.role === "admin";
                const status = off
                  ? "Access removed"
                  : p.last_sign_in_at
                  ? `Last signed in ${ago(p.last_sign_in_at)}`
                  : p.invited_at
                  ? `Invited ${ago(p.invited_at)}, hasn't joined yet`
                  : "Hasn't signed in yet";
                const rowBusy = busy === "edit:" + p.id || busy === "link:" + p.id;
                return (
                  <li key={p.id} className={`flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center ${off ? "opacity-60" : ""}`}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand/30 text-sm font-semibold uppercase text-taupe">
                        {(p.full_name || p.email).slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink">{p.full_name || p.email.split("@")[0]}</span>
                          {isAdmin && (
                            <span className="rounded-full bg-taupe/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-taupe">
                              Admin
                            </span>
                          )}
                          {isMe && <span className="text-xs text-ink/50">(you)</span>}
                        </div>
                        <div translate="no" className="truncate text-sm text-ink/60">
                          {p.email}
                        </div>
                        <div className="text-xs text-ink/50">{status}</div>
                      </div>
                    </div>
                    {!isMe && (
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {off ? (
                          <button disabled={rowBusy} onClick={() => update(p, { active: true })} className="btn-secondary !px-4 !py-2">
                            Restore access
                          </button>
                        ) : (
                          <>
                            <button disabled={rowBusy} onClick={() => newLink(p)} className="btn-secondary !px-4 !py-2">
                              New link
                            </button>
                            <button
                              disabled={rowBusy}
                              onClick={() =>
                                update(
                                  p,
                                  { role: isAdmin ? "staff" : "admin" },
                                  isAdmin ? undefined : `Make ${p.full_name || p.email} an admin? They'll be able to invite and remove people.`
                                )
                              }
                              className="btn-secondary !px-4 !py-2"
                            >
                              {isAdmin ? "Make employee" : "Make admin"}
                            </button>
                            <button
                              disabled={rowBusy}
                              onClick={() =>
                                update(p, { active: false }, `Remove access for ${p.full_name || p.email}? They won't be able to sign in.`)
                              }
                              className="btn-danger !px-4 !py-2"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="mt-6 text-sm leading-relaxed text-ink/60">
          <b className="text-ink/80">About the shared access code:</b> anyone who knows it can still get in, and they
          won&apos;t show up on this list. Once everyone has their own invite, change <span className="font-mono">ACCESS_CODE</span>{" "}
          in Vercel to shut the old code off.
        </p>
      </div>
    </Shell>
  );
}
