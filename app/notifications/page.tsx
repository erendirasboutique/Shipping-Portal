"use client";

// Settings › Notifications
// Edit the 4 customer messages (bilingual email + text), turn each on/off,
// change the logo/colors/tagline, send yourself a test, and see what was sent.

import { useCallback, useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";

type Stage = "packed" | "in_transit" | "out_for_delivery" | "delivered";
type Template = {
  stage: Stage;
  email_enabled: boolean;
  sms_enabled: boolean;
  subject: string;
  heading_es: string;
  body_es: string;
  sms_body: string;
};
type Settings = {
  enabled: boolean;
  logo_url: string | null;
  tagline: string | null;
  business_address: string | null;
  reply_to: string | null;
  color_background: string;
  color_accent: string;
  color_border: string;
  color_text: string;
};
type LogRow = {
  id: string;
  stage: Stage;
  channel: "email" | "sms";
  sent_to: string | null;
  status: string;
  error: string | null;
  test: boolean;
  created_at: string;
  shipping_orders: { order_number: number | null; to_name: string | null } | null;
};

const STAGE_NAMES: Record<Stage, string> = {
  packed: "1 · Packed",
  in_transit: "2 · On the way",
  out_for_delivery: "3 · Out for delivery",
  delivered: "4 · Delivered",
};
const STAGE_WHEN: Record<Stage, string> = {
  packed: "When you buy the label",
  in_transit: "USPS's first scan",
  out_for_delivery: "USPS: out for delivery",
  delivered: "USPS: delivered",
};
const VARS = ["first_name", "customer_name", "order_number", "live_week", "ship_date", "eta", "carrier", "tracking_number", "tracking_link", "address", "scan_location", "delivered_time"];

type Field = "subject" | "heading_es" | "body_es" | "sms_body";

/** Rough text-message segment count (emoji/accents switch to the 70-character kind). */
function segments(text: string) {
  const full = text + "\n\nResponde STOP para cancelar.";
  const gsm = /^[\n\r A-Za-z0-9@£$¥èéùìòÇØøÅå_ÆæßÉ!"#%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/.test(full);
  const len = Array.from(full).length;
  const per = gsm ? (len <= 160 ? 160 : 153) : len <= 70 ? 70 : 67;
  return { len, count: Math.max(1, Math.ceil(len / per)) };
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<"messages" | "branding" | "history">("messages");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [ready, setReady] = useState<{ email: boolean; sms: boolean }>({ email: false, sms: false });
  const [stage, setStage] = useState<Stage>("packed");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ html: string; sms: string; subject: string } | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [history, setHistory] = useState<LogRow[] | null>(null);
  const lastField = useRef<Field>("body_es");
  const fieldRefs = useRef<Partial<Record<Field, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/notifications", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoadError(data?.error || "Couldn't load notifications.");
      return;
    }
    setTemplates(data.templates || []);
    setSettings(data.settings);
    setReady(data.ready || { email: false, sms: false });
    setDirty(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = templates.find((t) => t.stage === stage) || null;

  // Live preview (debounced) from what's on screen.
  useEffect(() => {
    if (!current || !settings) return;
    const timer = setTimeout(async () => {
      const res = await fetch("/api/notifications/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: current, settings }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) setPreview(data);
    }, 400);
    return () => clearTimeout(timer);
  }, [current, settings]);

  useEffect(() => {
    if (tab !== "history") return;
    setHistory(null);
    fetch("/api/notifications/history", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setHistory(d.rows || []))
      .catch(() => setHistory([]));
  }, [tab]);

  function editTemplate(patch: Partial<Template>) {
    setTemplates((ts) => ts.map((t) => (t.stage === stage ? { ...t, ...patch } : t)));
    setDirty(true);
  }
  function editSettings(patch: Partial<Settings>) {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    setDirty(true);
  }

  function insertVar(v: string) {
    if (!current) return;
    const f = lastField.current;
    const el = fieldRefs.current[f];
    const token = "{" + v + "}";
    const value = String(current[f] || "");
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    editTemplate({ [f]: value.slice(0, start) + token + value.slice(end) } as Partial<Template>);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save(): Promise<boolean> {
    setBusy("save");
    setNotice(null);
    const res = await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templates, settings }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setNotice(data?.error || "Couldn't save.");
      return false;
    }
    setDirty(false);
    setNotice("Saved.");
    return true;
  }

  async function sendTest() {
    if (dirty && !(await save())) return;
    setBusy("test");
    setNotice(null);
    const res = await fetch("/api/notifications/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, email: testEmail || undefined, phone: testPhone || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setNotice(data?.error || "Test failed.");
    const r = data.result || {};
    setNotice(
      [r.email ? "Email: " + (r.email === "sent" ? "sent to " + (testEmail || "your email") : r.email) : null, r.sms ? "Text: " + r.sms : null]
        .filter(Boolean)
        .join(" · ") || "Nothing to send."
    );
  }

  const fieldProps = (f: Field) => ({
    ref: (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      fieldRefs.current[f] = el;
    },
    onFocus: () => {
      lastField.current = f;
    },
  });

  if (loadError) {
    return (
      <Shell>
        <div className="mx-auto max-w-xl">
          <h1 className="text-4xl">Customer notifications</h1>
          <div className="card mt-6 text-sm leading-relaxed">{loadError}</div>
        </div>
      </Shell>
    );
  }

  const seg = current ? segments(current.sms_body) : { len: 0, count: 0 };

  return (
    <Shell>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Settings</p>
            <h1 className="mt-1 text-4xl">Customer notifications</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {notice && <span className="text-sm text-ink/70">{notice}</span>}
            <button className="btn-primary" onClick={save} disabled={!dirty || busy === "save"}>
              {busy === "save" ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </div>

        {/* Setup status */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="pill">{settings?.enabled ? "Notifications on" : "Notifications off"}</span>
          <span className="pill">{ready.email ? "Email ready" : "Email not set up"}</span>
          <span className="pill">{ready.sms ? "Texting ready" : "Texting not set up (Twilio)"}</span>
        </div>

        <div className="mt-5 flex gap-1 border-b border-taupe/20">
          {(["messages", "branding", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={"px-4 py-2.5 text-sm " + (tab === t ? "border-b-2 border-taupe text-ink" : "text-taupe")}
            >
              {t === "messages" ? "Messages" : t === "branding" ? "Branding" : "Send history"}
            </button>
          ))}
        </div>

        {tab === "messages" && (
          <div className="mt-6 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,420px)]">
            {/* Message list */}
            <div className="flex flex-col gap-2">
              {templates.map((t) => (
                <button
                  key={t.stage}
                  onClick={() => setStage(t.stage)}
                  className={
                    "rounded-2xl border bg-white p-4 text-left transition " +
                    (t.stage === stage ? "border-2 border-taupe" : "border-taupe/20 hover:border-taupe/50")
                  }
                >
                  <div className="font-heading text-lg text-taupe">{STAGE_NAMES[t.stage]}</div>
                  <div className="mt-0.5 text-xs text-ink/60">{STAGE_WHEN[t.stage]}</div>
                  <div className="mt-2 flex gap-1.5 text-[11px]">
                    <span className={"rounded-full px-2 py-0.5 " + (t.email_enabled ? "bg-taupe text-cream" : "border border-taupe/30")}>
                      Email {t.email_enabled ? "on" : "off"}
                    </span>
                    <span className={"rounded-full px-2 py-0.5 " + (t.sms_enabled ? "bg-taupe text-cream" : "border border-taupe/30")}>
                      Text {t.sms_enabled ? "on" : "off"}
                    </span>
                  </div>
                </button>
              ))}
              <p className="px-1 pt-1 text-xs leading-relaxed text-ink/60">
                Customers with no email and no phone are skipped. Each message goes out once per order.
              </p>
            </div>

            {/* Editor */}
            {current && (
              <div className="flex min-w-0 flex-col gap-5">
                <div className="card flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl">Email</h2>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={current.email_enabled} onChange={(e) => editTemplate({ email_enabled: e.target.checked })} />
                      Send this email
                    </label>
                  </div>
                  <div>
                    <label className="label">Subject line</label>
                    <input className="input" value={current.subject} onChange={(e) => editTemplate({ subject: e.target.value })} {...fieldProps("subject")} />
                  </div>
                  <div>
                    <label className="label">Heading</label>
                    <input className="input" value={current.heading_es} onChange={(e) => editTemplate({ heading_es: e.target.value })} {...fieldProps("heading_es")} />
                  </div>
                  <div>
                    <label className="label">Message</label>
                    <textarea className="input min-h-[110px]" value={current.body_es} onChange={(e) => editTemplate({ body_es: e.target.value })} {...fieldProps("body_es")} />
                  </div>
                  <p className="text-xs leading-relaxed text-ink/60">
                    The progress bar, button, tracking details and "Artículos en este envío" ({"{customer_name}"} · Live · {"{live_week}"}) are added
                    automatically.
                  </p>
                </div>

                <div className="card flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl">Text message</h2>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={current.sms_enabled} onChange={(e) => editTemplate({ sms_enabled: e.target.checked })} />
                      Send this text
                    </label>
                  </div>
                  <textarea className="input min-h-[200px]" value={current.sms_body} onChange={(e) => editTemplate({ sms_body: e.target.value })} {...fieldProps("sms_body")} />
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-ink/60">
                    <span>"Responde STOP para cancelar." is added automatically. Texts late at night wait until 8am.</span>
                    <span>
                      ~{seg.len} characters · {seg.count} text segment{seg.count === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div className="card">
                  <p className="label">Tap to insert into the box you last clicked</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {VARS.map((v) => (
                      <button key={v} onClick={() => insertVar(v)} className="rounded-full border border-taupe/30 bg-cream px-2.5 py-1 text-xs hover:border-taupe">
                        {"{" + v + "}"}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-ink/60">
                    If an order is missing a detail (like the delivery estimate), the line that uses it is left out.
                  </p>
                </div>

                <div className="card flex flex-col gap-3">
                  <h2 className="text-2xl">Send a test</h2>
                  <p className="text-xs text-ink/60">Uses a made-up order. Saves your changes first.</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="label">Email (blank = yours)</label>
                      <input className="input" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@erendirasboutique.com" />
                    </div>
                    <div>
                      <label className="label">Phone (optional)</label>
                      <input className="input" type="tel" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="(714) 555-0123" />
                    </div>
                  </div>
                  <div>
                    <button className="btn-secondary" onClick={sendTest} disabled={busy === "test"}>
                      {busy === "test" ? "Sending…" : "Send test"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="flex min-w-0 flex-col gap-4">
              <div className="card p-3">
                <p className="label px-2 pt-1">Email preview</p>
                {preview && <p className="px-2 pb-2 text-xs text-ink/70">Subject: {preview.subject}</p>}
                <iframe
                  title="Email preview"
                  className="h-[720px] w-full rounded-2xl border border-taupe/20 bg-cream"
                  sandbox=""
                  srcDoc={preview?.html || ""}
                />
              </div>
              <div className="card">
                <p className="label">Text preview</p>
                <div className="mt-2 whitespace-pre-line rounded-3xl bg-cream px-4 py-3 text-sm leading-relaxed" style={{ fontFamily: "system-ui, sans-serif" }}>
                  {preview?.sms || ""}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "branding" && settings && (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="card flex flex-col gap-4">
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={settings.enabled} onChange={(e) => editSettings({ enabled: e.target.checked })} />
                <span>
                  <b>Send customer notifications</b>
                  <br />
                  <span className="text-ink/60">Turn off to pause every email and text.</span>
                </span>
              </label>
              <div>
                <label className="label">Logo link (blank = your portal logo)</label>
                <input
                  className="input"
                  value={settings.logo_url || ""}
                  placeholder="https://ship.erendirasboutique.com/logo2.png"
                  onChange={(e) => editSettings({ logo_url: e.target.value.trim() || null })}
                />
                <p className="mt-1 text-xs text-ink/60">Must be an https:// link to a PNG or JPG. Emails can't use SVG.</p>
              </div>
              <div>
                <label className="label">Footer tagline</label>
                <input className="input" value={settings.tagline || ""} onChange={(e) => editSettings({ tagline: e.target.value })} />
              </div>
              <div>
                <label className="label">Business address (shown in the footer)</label>
                <input
                  className="input"
                  value={settings.business_address || ""}
                  placeholder="Street, City, CA ZIP"
                  onChange={(e) => editSettings({ business_address: e.target.value })}
                />
                <p className="mt-1 text-xs text-ink/60">Marketing-style emails are required to show a mailing address. A PO box works.</p>
              </div>
              <div>
                <label className="label">Customer replies go to</label>
                <input
                  className="input"
                  type="email"
                  value={settings.reply_to || ""}
                  placeholder="hello@erendirasboutique.com"
                  onChange={(e) => editSettings({ reply_to: e.target.value.trim() || null })}
                />
              </div>
            </div>
            <div className="card flex flex-col gap-4">
              <h2 className="text-2xl">Colors</h2>
              {(
                [
                  ["color_background", "Background"],
                  ["color_accent", "Headings & buttons"],
                  ["color_border", "Borders"],
                  ["color_text", "Body text"],
                ] as const
              ).map(([k, name]) => (
                <div key={k} className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label={name}
                    value={settings[k]}
                    onChange={(e) => editSettings({ [k]: e.target.value } as Partial<Settings>)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-taupe/30 bg-white"
                  />
                  <span className="flex-1 text-sm">{name}</span>
                  <input className="input w-32" value={settings[k]} onChange={(e) => editSettings({ [k]: e.target.value } as Partial<Settings>)} />
                </div>
              ))}
              <button
                className="btn-secondary self-start"
                onClick={() => editSettings({ color_background: "#F5F3EF", color_accent: "#957f67", color_border: "#cfbda9", color_text: "#332b23" })}
              >
                Reset to brand colors
              </button>
              <p className="text-xs leading-relaxed text-ink/60">
                Fonts: Palatino for headings and Avenir Next for text. Both are built into iPhones, Macs and most computers, so they look the
                same in Gmail and Apple Mail. (Android Gmail uses its own font.)
              </p>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="card mt-6 overflow-x-auto p-0">
            {history === null ? (
              <p className="p-6 text-sm">Loading…</p>
            ) : history.length === 0 ? (
              <p className="p-6 text-sm">Nothing sent yet.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">When</th>
                    <th className="table-th">Order</th>
                    <th className="table-th">Message</th>
                    <th className="table-th">Sent to</th>
                    <th className="table-th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id} className="border-b border-taupe/10">
                      <td className="table-td whitespace-nowrap">{when(r.created_at)}</td>
                      <td className="table-td">
                        {r.test ? (
                          <span className="pill">Test</span>
                        ) : (
                          <>
                            {r.shipping_orders?.order_number != null ? "EB-" + r.shipping_orders.order_number : ""} {r.shipping_orders?.to_name || ""}
                          </>
                        )}
                      </td>
                      <td className="table-td">
                        {STAGE_NAMES[r.stage]} · {r.channel === "email" ? "Email" : "Text"}
                      </td>
                      <td className="table-td">{r.sent_to || "—"}</td>
                      <td className="table-td">
                        <span className="pill">{r.status}</span>
                        {r.error && <div className="mt-1 text-xs text-ink/60">{r.error}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
