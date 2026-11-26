"use client";

// Notifications › Send a message — custom emails and texts with presets,
// a contact card option, live previews, a test send, and a progress bar.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Channels = "email" | "sms" | "both";
type Audience = "sms_subscribers" | "emails" | "live_week" | "one";
type Message = {
  sms_body: string;
  email_subject: string;
  email_heading: string;
  email_body: string;
  button_text: string;
  button_link: string;
  attach_card_sms: boolean;
  attach_card_email: boolean;
};
type Preset = Message & { id: string; name: string; description: string | null; built_in: boolean };
type Counts = Record<string, { email: number; sms: number }>;
type Recent = { id: string; channels: Channels; audience: Audience; message: Message; status: string; total: number; sent: number; failed: number; created_at: string };
type Customer = { id: string; name: string; email: string | null; phone: string | null; textsOk: boolean };

const BLANK: Message = {
  sms_body: "",
  email_subject: "",
  email_heading: "",
  email_body: "",
  button_text: "",
  button_link: "",
  attach_card_sms: false,
  attach_card_email: false,
};

const AUDIENCE_NAMES: Record<Audience, string> = {
  sms_subscribers: "Everyone who signed up for texts",
  emails: "Everyone with an email on file",
  live_week: "Customers on this week's Live List",
  one: "One customer",
};

function fill(text: string, firstName: string, liveLink: string) {
  return String(text || "")
    .split("\n")
    .filter((l) => !(l.includes("{live_link}") && !liveLink))
    .map((l) => l.replace(/\s*\{first_name\}/g, (m) => (firstName ? m.replace("{first_name}", firstName) : "")).replace(/\{live_link\}/g, liveLink))
    .join("\n")
    .trim();
}

function smsText(m: Message, liveLink: string) {
  let b = fill(m.sms_body, "Chula", liveLink);
  if (!/^erendira/i.test(b)) b = "Erendira's Boutique: " + b;
  return b + "\n\nResponde STOP para cancelar.";
}

function segments(text: string) {
  const gsm = /^[\n\r A-Za-z0-9@£$¥èéùìòÇØøÅå_ÆæßÉ!"#%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/.test(text);
  const len = Array.from(text).length;
  const per = gsm ? (len <= 160 ? 160 : 153) : len <= 70 ? 70 : 67;
  return { len, count: Math.max(1, Math.ceil(len / per)) };
}

export default function BroadcastComposer() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Message>(BLANK);
  const [channels, setChannels] = useState<Channels>("both");
  const [audience, setAudience] = useState<Audience>("sms_subscribers");
  const [counts, setCounts] = useState<Counts>({});
  const [liveLink, setLiveLink] = useState("");
  const [ready, setReady] = useState({ email: false, sms: false });
  const [recent, setRecent] = useState<Recent[]>([]);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [progress, setProgress] = useState<{ id: string; total: number; sent: number; failed: number; remaining: number; status: string } | null>(null);
  const cancelRef = useRef(false);

  const load = useCallback(async () => {
    const [p, b] = await Promise.all([
      fetch("/api/broadcasts/presets", { cache: "no-store" }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
      fetch("/api/broadcasts", { cache: "no-store" }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
    ]);
    if (!p.ok || !b.ok) {
      setSetupError((!p.ok ? p.d?.error : b.d?.error) || "Couldn't load.");
      return;
    }
    setPresets(p.d.presets || []);
    setCounts(b.d.counts || {});
    setLiveLink(b.d.liveLink || "");
    setReady(b.d.ready || { email: false, sms: false });
    setRecent(b.d.recent || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Pick the first preset once they load.
  useEffect(() => {
    if (!presetId && presets.length) pickPreset(presets[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets]);

  // Customer search for "One customer…"
  useEffect(() => {
    if (audience !== "one" || q.trim().length < 2) {
      setMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await fetch("/api/broadcasts/customers?q=" + encodeURIComponent(q.trim()));
      const d = await r.json().catch(() => ({}));
      setMatches(d.customers || []);
    }, 300);
    return () => clearTimeout(t);
  }, [q, audience]);

  function pickPreset(p: Preset) {
    setPresetId(p.id);
    setMsg({
      sms_body: p.sms_body,
      email_subject: p.email_subject,
      email_heading: p.email_heading,
      email_body: p.email_body,
      button_text: p.button_text,
      button_link: p.button_link,
      attach_card_sms: p.attach_card_sms,
      attach_card_email: p.attach_card_email,
    });
    setNotice(null);
  }
  const edit = (patch: Partial<Message>) => setMsg((m) => ({ ...m, ...patch }));

  const wantEmail = channels !== "sms";
  const wantSms = channels !== "email";

  const reach = useMemo(() => {
    if (audience === "one") {
      if (!customer) return { email: 0, sms: 0 };
      return { email: wantEmail && customer.email ? 1 : 0, sms: wantSms && customer.textsOk ? 1 : 0 };
    }
    const c = counts[audience] || { email: 0, sms: 0 };
    return { email: wantEmail ? c.email : 0, sms: wantSms ? c.sms : 0 };
  }, [audience, counts, customer, wantEmail, wantSms]);

  const preview = smsText(msg, liveLink || "facebook.com/…");
  const seg = segments(preview);
  const perText = msg.attach_card_sms ? 0.03 : 0.008 * seg.count; // rough Telnyx + carrier fees
  const cost = reach.sms * perText;

  async function savePreset() {
    const name = window.prompt("Name for this preset (like 🎄 Live navideño):");
    if (!name) return;
    const r = await fetch("/api/broadcasts/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message: msg }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setNotice(d.error || "Couldn't save.");
    setPresets((ps) => [...ps, d.preset]);
    setPresetId(d.preset.id);
    setNotice("Preset saved.");
  }

  async function deletePreset(p: Preset) {
    if (!window.confirm(`Delete the preset "${p.name}"?`)) return;
    await fetch("/api/broadcasts/presets?id=" + encodeURIComponent(p.id), { method: "DELETE" });
    setPresets((ps) => ps.filter((x) => x.id !== p.id));
  }

  async function sendTest() {
    setBusy("test");
    setNotice(null);
    const r = await fetch("/api/broadcasts/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels, phone: testPhone, message: msg }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setNotice(d.error || "Test failed.");
    const res = d.result || {};
    setNotice(
      [res.email ? "Email: " + (res.email === "sent" ? "sent to you" : res.email) : null, res.sms ? "Text: " + (res.sms === "sent" ? "sent" : res.sms) : null]
        .filter(Boolean)
        .join(" · ")
    );
  }

  async function sendNow() {
    const total = reach.email + reach.sms;
    if (!total) return setNotice("Nobody to send to with these choices.");
    const parts = [reach.sms ? `${reach.sms} text${reach.sms === 1 ? "" : "s"}` : "", reach.email ? `${reach.email} email${reach.email === 1 ? "" : "s"}` : ""].filter(Boolean);
    if (!window.confirm(`Send ${parts.join(" and ")} now?`)) return;
    setBusy("send");
    setNotice(null);
    cancelRef.current = false;
    const r = await fetch("/api/broadcasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels, audience, customerId: customer?.id || null, message: msg }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setBusy(null);
      return setNotice(d.error || "Couldn't start the send.");
    }
    let state = { id: d.id, total: d.total, sent: 0, failed: 0, remaining: d.total, status: "sending" };
    setProgress(state);
    while (state.remaining > 0 && state.status === "sending" && !cancelRef.current) {
      const s = await fetch(`/api/broadcasts/${d.id}/send`, { method: "POST" });
      const sd = await s.json().catch(() => ({}));
      if (!s.ok) {
        setNotice(sd.error || "Sending stopped. Press Send again to retry.");
        break;
      }
      state = { ...state, ...sd };
      setProgress(state);
    }
    setBusy(null);
    load();
  }

  async function cancel() {
    if (!progress) return;
    cancelRef.current = true;
    await fetch(`/api/broadcasts/${progress.id}/cancel`, { method: "POST" });
    setProgress({ ...progress, status: "cancelled" });
  }

  if (setupError) return <div className="card mt-6 text-sm leading-relaxed">{setupError}</div>;

  const pct = progress && progress.total ? Math.round(((progress.total - progress.remaining) / progress.total) * 100) : 0;

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)_minmax(0,340px)]">
      {/* Presets */}
      <div className="flex flex-col gap-2">
        <p className="label">Start from</p>
        {presets.map((p) => (
          <div key={p.id} className="relative">
            <button
              onClick={() => pickPreset(p)}
              className={"w-full rounded-2xl bg-white p-4 text-left transition " + (p.id === presetId ? "border-2 border-taupe" : "border border-taupe/20 hover:border-taupe/50")}
            >
              <div className="font-heading text-lg text-taupe">{p.name}</div>
              {p.description && <div className="mt-0.5 text-xs text-ink/60">{p.description}</div>}
            </button>
            {!p.built_in && (
              <button onClick={() => deletePreset(p)} aria-label={`Delete ${p.name}`} className="absolute right-3 top-3 text-xs text-ink/40 hover:text-ink">
                ✕
              </button>
            )}
          </div>
        ))}
        <button onClick={savePreset} className="px-1 py-2 text-left text-sm text-taupe hover:underline">
          + Save current message as a preset
        </button>
      </div>

      {/* Composer */}
      <div className="flex min-w-0 flex-col gap-5">
        <div className="card flex flex-col gap-5">
          <div>
            <p className="label">Send as</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {(["email", "sms", "both"] as Channels[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setChannels(c)}
                  className={"rounded-full px-4 py-2 text-sm " + (channels === c ? "bg-taupe text-cream" : "border border-taupe/30 bg-white")}
                >
                  {c === "email" ? "Email" : c === "sms" ? "Text" : "Email + Text"}
                </button>
              ))}
            </div>
            {!ready.sms && wantSms && <p className="mt-2 text-xs text-ink/60">Texting isn&rsquo;t set up yet (Telnyx), so texts will fail until it is.</p>}
            {!ready.email && wantEmail && <p className="mt-2 text-xs text-ink/60">Email isn&rsquo;t set up yet (Resend).</p>}
          </div>
          <div>
            <p className="label">Send to</p>
            <div className="mt-1 flex flex-col gap-2">
              {(["sms_subscribers", "emails", "live_week", "one"] as Audience[]).map((a) => {
                const c = counts[a];
                const n = a === "one" || !c ? "" : [wantSms ? `${c.sms} text${c.sms === 1 ? "" : "s"}` : "", wantEmail ? `${c.email} email${c.email === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
                return (
                  <label key={a} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="aud" checked={audience === a} onChange={() => setAudience(a)} />
                    {AUDIENCE_NAMES[a]}
                    {n && <span className="text-taupe">· {n}</span>}
                  </label>
                );
              })}
            </div>
            {audience === "one" && (
              <div className="mt-3">
                {customer ? (
                  <div className="flex items-center justify-between rounded-2xl border border-taupe/30 bg-cream px-4 py-2 text-sm">
                    <span>
                      {customer.name} · {customer.email || "no email"} · {customer.textsOk ? "texts ok" : "not signed up for texts"}
                    </span>
                    <button onClick={() => setCustomer(null)} className="text-taupe">
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone" />
                    {matches.length > 0 && (
                      <div className="mt-1 overflow-hidden rounded-2xl border border-taupe/20 bg-white">
                        {matches.map((m) => (
                          <button key={m.id} onClick={() => { setCustomer(m); setQ(""); }} className="block w-full border-b border-taupe/10 px-4 py-2 text-left text-sm hover:bg-cream">
                            {m.name} <span className="text-ink/50">· {m.email || "no email"} · {m.textsOk ? "texts ok" : "no texts"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-ink/60">Texts only go to people who signed up. Emails skip anyone who unsubscribed.</p>
          </div>
        </div>

        {wantSms && (
          <div className="card flex flex-col gap-3">
            <h2 className="text-2xl">Text message</h2>
            <textarea className="input min-h-[120px]" value={msg.sms_body} onChange={(e) => edit({ sms_body: e.target.value })} placeholder="¡Hola {first_name}! …" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={msg.attach_card_sms} onChange={(e) => edit({ attach_card_sms: e.target.checked })} />
              Attach our contact card 📇 <span className="text-xs text-ink/50">(sends as a picture message, ~3–4× the cost)</span>
            </label>
            <div className="flex flex-wrap justify-between gap-2 text-xs text-ink/60">
              <span>
                Use {"{first_name}"} and {"{live_link}"}. &ldquo;Erendira&rsquo;s Boutique:&rdquo; and &ldquo;Responde STOP para cancelar.&rdquo; are added automatically.
              </span>
              <span>
                ~{seg.len} characters · {seg.count} segment{seg.count === 1 ? "" : "s"}
              </span>
            </div>
            {!liveLink && /\{live_link\}/.test(msg.sms_body + msg.button_link) && (
              <p className="text-xs text-red-800">No live link is set in the Customer Portal admin, so the {"{live_link}"} line will be left out.</p>
            )}
          </div>
        )}

        {wantEmail && (
          <div className="card flex flex-col gap-3">
            <h2 className="text-2xl">Email</h2>
            <div>
              <label className="label">Subject</label>
              <input className="input" value={msg.email_subject} onChange={(e) => edit({ email_subject: e.target.value })} />
            </div>
            <div>
              <label className="label">Heading</label>
              <input className="input" value={msg.email_heading} onChange={(e) => edit({ email_heading: e.target.value })} />
            </div>
            <div>
              <label className="label">Message</label>
              <textarea className="input min-h-[110px]" value={msg.email_body} onChange={(e) => edit({ email_body: e.target.value })} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">Button text (optional)</label>
                <input className="input" value={msg.button_text} onChange={(e) => edit({ button_text: e.target.value })} placeholder="Ver el live" />
              </div>
              <div>
                <label className="label">Button link</label>
                <input className="input" value={msg.button_link} onChange={(e) => edit({ button_link: e.target.value })} placeholder="{live_link} or https://…" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={msg.attach_card_email} onChange={(e) => edit({ attach_card_email: e.target.checked })} />
              Attach our contact card 📇
            </label>
            <p className="text-xs text-ink/60">A &ldquo;Darse de baja&rdquo; (unsubscribe) link is added automatically, as the law requires for promotional emails.</p>
          </div>
        )}

        <div className="card flex flex-col gap-3">
          {progress ? (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span>
                  {progress.status === "done" ? "Done! " : progress.status === "cancelled" ? "Stopped. " : "Sending… "}
                  {progress.sent} sent{progress.failed ? ` · ${progress.failed} failed` : ""} of {progress.total}
                </span>
                {progress.status === "sending" && busy === "send" && (
                  <button onClick={cancel} className="text-taupe">
                    Stop
                  </button>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-taupe/15">
                <div className="h-full bg-taupe transition-all" style={{ width: pct + "%" }} />
              </div>
              {busy === "send" && <p className="text-xs text-ink/60">Keep this page open until it finishes.</p>}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm">
              Sends to <b>{reach.sms + reach.email}</b>
              {reach.sms ? ` · texts ≈ $${cost.toFixed(2)}` : ""}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {wantSms && <input className="input w-44" type="tel" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="Your phone (test)" />}
              <button className="btn-secondary" onClick={sendTest} disabled={!!busy}>
                {busy === "test" ? "Sending…" : "Send test to me"}
              </button>
              <button className="btn-primary" onClick={sendNow} disabled={!!busy || reach.sms + reach.email === 0}>
                {busy === "send" ? "Sending…" : "Send now"}
              </button>
            </div>
          </div>
          {notice && <p className="text-sm text-ink/70">{notice}</p>}
        </div>

        {recent.length > 0 && (
          <div className="card overflow-x-auto p-0">
            <p className="label px-5 pt-4">Recent sends</p>
            <table className="w-full">
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t border-taupe/10">
                    <td className="table-td whitespace-nowrap">{new Date(r.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                    <td className="table-td">{(r.channels === "both" ? "Email + Text" : r.channels === "sms" ? "Text" : "Email") + " · " + AUDIENCE_NAMES[r.audience]}</td>
                    <td className="table-td max-w-[260px] truncate text-ink/70">{r.message?.email_subject || r.message?.sms_body}</td>
                    <td className="table-td whitespace-nowrap">
                      {r.sent}/{r.total}
                      {r.failed ? ` · ${r.failed} failed` : ""} <span className="pill">{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Previews */}
      <div className="flex min-w-0 flex-col gap-4">
        {wantSms && (
          <div className="card flex flex-col gap-2">
            <p className="label">Text preview</p>
            <div className="self-start whitespace-pre-line rounded-3xl rounded-bl-md bg-cream px-4 py-3 text-sm leading-relaxed" style={{ fontFamily: "system-ui, sans-serif" }}>
              {preview}
            </div>
            {msg.attach_card_sms && (
              <div className="flex w-56 items-center gap-3 self-start rounded-3xl bg-cream p-3" style={{ fontFamily: "system-ui, sans-serif" }}>
                <img src="/logo2.png" alt="" className="h-10 w-10 rounded-full bg-white object-contain p-1" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Erendira&rsquo;s Boutique</span>
                  <span className="text-xs text-ink/60">Contact card · Tap to save</span>
                </div>
              </div>
            )}
          </div>
        )}
        {wantEmail && (
          <div className="card flex flex-col gap-3">
            <p className="label">Email preview</p>
            <p className="text-xs text-ink/70">Subject: {fill(msg.email_subject, "Chula", liveLink)}</p>
            <div className="flex flex-col gap-3 rounded-2xl border border-taupe/15 p-5">
              <img src="/logo2.png" alt="Erendira's Boutique" className="h-auto w-28" />
              {msg.email_heading && <span style={{ fontFamily: "Palatino, 'Palatino Linotype', Georgia, serif", fontSize: 22 }}>{fill(msg.email_heading, "Chula", liveLink)}</span>}
              <span className="whitespace-pre-line text-sm leading-relaxed text-ink/70" style={{ fontFamily: "'Avenir Next', Avenir, Helvetica, sans-serif" }}>
                {fill(msg.email_body, "Chula", liveLink)}
              </span>
              {msg.button_text && (
                <span className="self-start rounded-md bg-taupe px-4 py-2 text-sm text-white" style={{ fontFamily: "'Avenir Next', Avenir, Helvetica, sans-serif" }}>
                  {msg.button_text}
                </span>
              )}
              <span className="border-t border-taupe/15 pt-2 text-[11px] text-ink/60" style={{ fontFamily: "'Avenir Next', Avenir, Helvetica, sans-serif" }}>
                {msg.attach_card_email ? "📎 Erendiras-Boutique.vcf · " : ""}Darse de baja
              </span>
            </div>
          </div>
        )}
        <a href="/api/public/contact-card" className="px-1 text-sm text-taupe hover:underline">
          Download the contact card (.vcf)
        </a>
      </div>
    </div>
  );
}
