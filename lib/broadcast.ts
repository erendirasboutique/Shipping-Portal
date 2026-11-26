// lib/broadcast.ts
// Server only. Notifications › Send a message: custom emails and texts.
//
//   - Audiences: everyone signed up for texts, everyone with an email,
//     this week's Live List, or one customer.
//   - Texts only go to numbers in sms_subscribers that haven't opted out.
//   - Emails skip anyone in email_unsubscribes and carry an unsubscribe link.
//   - A send is saved as a broadcast + one row per person, then sent in small
//     batches (the page keeps calling /send until it's done), so nothing times out.

import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentWeekStart } from "@/lib/liveList";
import { emailConfigured, loadSettings, sendEmail, sendSms, smsConfigured, toE164, DEFAULT_SETTINGS, type Settings } from "@/lib/customerNotify";

export type Channels = "email" | "sms" | "both";
export type Audience = "sms_subscribers" | "emails" | "live_week" | "one";

export type Message = {
  sms_body: string;
  email_subject: string;
  email_heading: string;
  email_body: string;
  button_text: string;
  button_link: string;
  attach_card_sms: boolean;
  attach_card_email: boolean;
};

type Person = { name: string | null; email: string | null; phone: string | null; customerId?: string | null };

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://ship.erendirasboutique.com").replace(/\/$/, "");
export const CARD_URL = SITE + "/api/public/contact-card";

// ---------------------------------------------------------------- helpers

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function firstName(name: string | null | undefined) {
  const n = (name || "").trim().split(/\s+/)[0] || "";
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : "";
}
function cleanEmail(e: string | null | undefined) {
  const v = String(e || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

/** {first_name} and {live_link}. With no name, "¡Hola {first_name}!" becomes "¡Hola!". A line whose link is missing is left out. */
export function fillMessage(text: string, vars: { first_name?: string; live_link?: string }) {
  return String(text || "")
    .split("\n")
    .filter((line) => !(line.includes("{live_link}") && !vars.live_link))
    .map((line) =>
      line
        .replace(/\s*\{first_name\}/g, (m) => (vars.first_name ? m.replace("{first_name}", vars.first_name) : ""))
        .replace(/\{live_link\}/g, vars.live_link || "")
    )
    .join("\n")
    .trim();
}

/** The current live link from the Customer Portal admin (live_link table), if any. */
export async function currentLiveLink(admin: any): Promise<string> {
  try {
    const { data } = await admin.from("live_link").select("url").eq("id", 1).maybeSingle();
    return (data?.url || "").trim();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------- unsubscribe links

function unsubSecret() {
  return process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "erendira";
}
export function unsubToken(email: string) {
  return crypto.createHmac("sha256", unsubSecret()).update(email.toLowerCase()).digest("hex").slice(0, 32);
}
export function validUnsub(email: string, token: string) {
  const a = Buffer.from(unsubToken(email));
  const b = Buffer.from(String(token || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
/** The "Darse de baja" page (shows a button, so email link-scanners can't unsubscribe anyone by opening it). */
export function unsubUrl(email: string) {
  return `${SITE}/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;
}
/** One-click endpoint for the List-Unsubscribe header (Gmail/Apple "Unsubscribe" button). */
export function unsubPostUrl(email: string) {
  return `${SITE}/api/public/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;
}
export async function unsubscribeEmail(email: string, source: string) {
  const admin: any = supabaseAdmin();
  await admin.from("email_unsubscribes").upsert({ email: email.toLowerCase(), source, unsubscribed_at: new Date().toISOString() }, { onConflict: "email" });
}

// ---------------------------------------------------------------- contact card

/** vCard for "Erendira's Boutique" with the texting number, email, website and logo. */
export async function contactCard(): Promise<string> {
  const settings = await loadSettings(supabaseAdmin()).catch(() => DEFAULT_SETTINGS);
  const phone = process.env.TELNYX_FROM || "";
  const email = settings.reply_to || "hello@erendirasboutique.com";
  let photo = "";
  try {
    const res = await fetch(SITE + "/logo2.png", { cache: "force-cache" });
    if (res.ok) {
      const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
      // vCard lines fold at 75 characters.
      photo = "PHOTO;ENCODING=b;TYPE=PNG:" + b64.replace(/(.{74})/g, "$1\r\n ");
    }
  } catch {
    /* no logo — card still works */
  }
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:Erendira's Boutique",
    "N:;Erendira's Boutique;;;",
    "ORG:Erendira's Boutique",
    phone ? `TEL;TYPE=CELL,VOICE,PREF:${phone}` : "",
    `EMAIL;TYPE=INTERNET:${email}`,
    "URL:https://erendirasboutique.com",
    "NOTE:Pedidos\\, envíos y lives · Orders\\, shipping and lives",
    photo,
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\r\n");
}

// ---------------------------------------------------------------- audiences

async function smsOkSet(admin: any): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  let from = 0;
  for (;;) {
    const { data, error } = await admin.from("sms_subscribers").select("phone, name").is("opted_out_at", null).range(from, from + 999);
    if (error || !data?.length) break;
    for (const r of data) out.set(r.phone, r.name || null);
    if (data.length < 1000) break;
    from += 1000;
  }
  return out;
}

async function unsubSet(admin: any): Promise<Set<string>> {
  const out = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await admin.from("email_unsubscribes").select("email").range(from, from + 999);
    if (error || !data?.length) break;
    for (const r of data) out.add(String(r.email).toLowerCase());
    if (data.length < 1000) break;
    from += 1000;
  }
  return out;
}

async function allCustomers(admin: any): Promise<Person[]> {
  const out: Person[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from("shipping_customers")
      .select("id, name, email, phone, archived, merged_into")
      .range(from, from + 999);
    if (error || !data?.length) break;
    for (const c of data) if (!c.archived && !c.merged_into) out.push({ name: c.name, email: c.email, phone: c.phone, customerId: c.id });
    if (data.length < 1000) break;
    from += 1000;
  }
  return out;
}

async function liveWeekPeople(admin: any): Promise<Person[]> {
  const week = currentWeekStart();
  const { data } = await admin
    .from("live_list")
    .select("name, order:shipping_orders(to_name, to_email, to_phone, customer_id)")
    .eq("week_start", week);
  const rows: any[] = data || [];
  const ids = rows.map((r) => r.order?.customer_id).filter(Boolean);
  const byId = new Map<string, any>();
  if (ids.length) {
    const { data: cs } = await admin.from("shipping_customers").select("id, email, phone").in("id", ids);
    for (const c of cs || []) byId.set(c.id, c);
  }
  return rows.map((r) => {
    const c = r.order?.customer_id ? byId.get(r.order.customer_id) : null;
    return { name: r.name || r.order?.to_name || null, email: r.order?.to_email || c?.email || null, phone: r.order?.to_phone || c?.phone || null };
  });
}

export type Recipient = { channel: "email" | "sms"; to: string; name: string | null };

/** Everyone a send would reach, one row per channel per person, no repeats. */
export async function resolveRecipients(audience: Audience, channels: Channels, customerId?: string | null): Promise<Recipient[]> {
  const admin: any = supabaseAdmin();
  const wantEmail = channels !== "sms";
  const wantSms = channels !== "email";
  const [smsOk, unsubs] = await Promise.all([wantSms ? smsOkSet(admin) : Promise.resolve(new Map()), wantEmail ? unsubSet(admin) : Promise.resolve(new Set<string>())]);

  let people: Person[] = [];
  if (audience === "sms_subscribers") {
    // Signed-up numbers; add their email from the customer list when it matches.
    const customers = wantEmail ? await allCustomers(admin) : [];
    const emailByPhone = new Map<string, string>();
    for (const c of customers) {
      const p = toE164(c.phone);
      const e = cleanEmail(c.email);
      if (p && e && !emailByPhone.has(p)) emailByPhone.set(p, e);
    }
    people = Array.from(smsOk.entries()).map(([phone, name]) => ({ name, phone, email: emailByPhone.get(phone) || null }));
  } else if (audience === "emails") {
    people = await allCustomers(admin);
  } else if (audience === "live_week") {
    people = await liveWeekPeople(admin);
  } else if (audience === "one" && customerId) {
    const { data } = await admin.from("shipping_customers").select("id, name, email, phone").eq("id", customerId).maybeSingle();
    if (data) people = [{ name: data.name, email: data.email, phone: data.phone, customerId: data.id }];
  }

  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const p of people) {
    if (wantEmail) {
      const e = cleanEmail(p.email);
      if (e && !unsubs.has(e) && !seen.has("e:" + e)) {
        seen.add("e:" + e);
        out.push({ channel: "email", to: e, name: p.name });
      }
    }
    if (wantSms) {
      const ph = toE164(p.phone);
      if (ph && smsOk.has(ph) && !seen.has("s:" + ph)) {
        seen.add("s:" + ph);
        out.push({ channel: "sms", to: ph, name: p.name || smsOk.get(ph) || null });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- rendering

export function renderBroadcastSms(m: Message, vars: { first_name?: string; live_link?: string }) {
  let body = fillMessage(m.sms_body, vars);
  if (!/^erendira/i.test(body)) body = "Erendira's Boutique: " + body;
  return body + "\n\nResponde STOP para cancelar.";
}

export function renderBroadcastEmail(m: Message, s: Settings, vars: { first_name?: string; live_link?: string }, unsubscribeLink: string) {
  const accent = /^#[0-9a-f]{3,8}$/i.test(s.color_accent || "") ? s.color_accent : DEFAULT_SETTINGS.color_accent;
  const ink = /^#[0-9a-f]{3,8}$/i.test(s.color_text || "") ? s.color_text : DEFAULT_SETTINGS.color_text;
  const bg = /^#[0-9a-f]{3,8}$/i.test(s.color_background || "") ? s.color_background : DEFAULT_SETTINGS.color_background;
  const muted = "#6b5f53";
  const line = "#EAE4DC";
  const HEAD = "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
  const BODY = "'Avenir Next', Avenir, 'Segoe UI', Helvetica, Arial, sans-serif";
  const logo = s.logo_url && /^https:\/\//.test(s.logo_url) ? s.logo_url : SITE + "/logo2.png";
  const subject = fillMessage(m.email_subject, vars).replace(/\n/g, " ");
  const heading = esc(fillMessage(m.email_heading, vars));
  const body = esc(fillMessage(m.email_body, vars)).replace(/\n/g, "<br>");
  const link = fillMessage(m.button_link, vars);
  const btn = m.button_text && /^https?:\/\//.test(link)
    ? `<tr><td style="padding:0 0 28px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${accent};border-radius:8px;"><a href="${esc(link)}" style="display:inline-block;padding:15px 26px;font-family:${BODY};font-size:16px;font-weight:500;color:#ffffff;text-decoration:none;">${esc(m.button_text)}</a></td></tr></table></td></tr>`
    : "";
  const card = m.attach_card_email
    ? `<tr><td style="padding:0 0 24px;"><div style="background:${bg};border-radius:8px;padding:14px 16px;font-family:${BODY};font-size:14px;line-height:1.55;color:${muted};">📇 Te adjuntamos nuestra tarjeta de contacto. Ábrela y toca <b>Agregar contacto</b> para guardarnos.</div></td></tr>`
    : "";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;">
<tr><td style="padding:40px 40px 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:0 0 28px;"><img src="${esc(logo)}" alt="Erendira's Boutique" width="170" style="display:block;width:170px;height:auto;border:0;"></td></tr>
    <tr><td style="padding:0 0 24px;">
      ${heading ? `<h1 style="margin:0 0 10px;font-family:${HEAD};font-weight:normal;font-size:30px;line-height:1.2;color:${ink};">${heading}</h1>` : ""}
      <p style="margin:0;font-family:${BODY};font-size:16px;line-height:1.55;color:${muted};">${body}</p>
    </td></tr>
    ${btn}
    ${card}
    <tr><td style="border-top:1px solid ${line};padding-top:22px;font-family:${BODY};font-size:12px;line-height:1.6;color:${muted};">
      ${s.tagline ? `<div style="font-family:${HEAD};font-size:16px;color:${accent};padding-bottom:8px;">${esc(s.tagline)}</div>` : ""}
      ¿Preguntas? Responde a este correo o escríbenos por <a href="https://ebtq.io/messenger" style="color:${accent};">Messenger</a>.<br>
      ${s.business_address ? esc(s.business_address) + " · " : ""}<a href="${esc(unsubscribeLink)}" style="color:${accent};">Darse de baja</a> de estos correos.
    </td></tr>
  </table>
</td></tr></table>
</td></tr></table>
</body></html>`;
  const text = [fillMessage(m.email_heading, vars), fillMessage(m.email_body, vars), /^https?:\/\//.test(link) ? link : "", "Darse de baja: " + unsubscribeLink]
    .filter(Boolean)
    .join("\n\n");
  return { subject, html, text };
}

// ---------------------------------------------------------------- sending

async function sendOne(r: { channel: "email" | "sms"; to: string; name: string | null }, m: Message, s: Settings, liveLink: string, card: string | null) {
  const vars = { first_name: firstName(r.name), live_link: liveLink };
  if (r.channel === "sms") {
    if (!smsConfigured()) throw new Error("Texting isn't set up yet (Telnyx).");
    return sendSms(r.to, renderBroadcastSms(m, vars), null, undefined, m.attach_card_sms ? [CARD_URL] : undefined);
  }
  if (!emailConfigured()) throw new Error("Email isn't set up (RESEND_API_KEY / EMAIL_FROM).");
  const u = unsubUrl(r.to);
  const e = renderBroadcastEmail(m, s, vars, u);
  return sendEmail(r.to, e.subject, e.html, e.text, s.reply_to, {
    attachments: m.attach_card_email && card ? [{ filename: "Erendiras-Boutique.vcf", content: Buffer.from(card).toString("base64") }] : undefined,
    headers: { "List-Unsubscribe": `<${unsubPostUrl(r.to)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sends the next few people of a broadcast. Returns what's left. */
export async function sendBatch(broadcastId: string, size = 8): Promise<{ remaining: number; sent: number; failed: number; status: string }> {
  const admin: any = supabaseAdmin();
  const { data: b } = await admin.from("broadcasts").select("*").eq("id", broadcastId).maybeSingle();
  if (!b) throw new Error("That send wasn't found.");
  if (b.status !== "sending") return { remaining: 0, sent: b.sent, failed: b.failed, status: b.status };

  const { data: pending } = await admin.from("broadcast_recipients").select("id").eq("broadcast_id", broadcastId).eq("status", "pending").limit(size);
  const ids = (pending || []).map((r: any) => r.id);
  let claimed: any[] = [];
  if (ids.length) {
    const { data } = await admin.from("broadcast_recipients").update({ status: "sending" }).in("id", ids).eq("status", "pending").select("id, channel, to_addr, name");
    claimed = data || [];
  }

  const m: Message = b.message;
  const [settings, liveLink] = await Promise.all([loadSettings(admin), currentLiveLink(admin)]);
  const card = m.attach_card_email && claimed.some((r) => r.channel === "email") ? await contactCard() : null;

  let sentNow = 0;
  let failedNow = 0;
  for (const r of claimed) {
    try {
      const id = await sendOne({ channel: r.channel, to: r.to_addr, name: r.name }, m, settings, liveLink, card);
      await admin.from("broadcast_recipients").update({ status: "sent", provider_id: id, sent_at: new Date().toISOString() }).eq("id", r.id);
      sentNow++;
    } catch (e: any) {
      await admin.from("broadcast_recipients").update({ status: "failed", error: String(e?.message || "failed").slice(0, 300) }).eq("id", r.id);
      failedNow++;
    }
    await sleep(r.channel === "email" ? 550 : 250); // Resend allows ~2 emails/second
  }

  const { count } = await admin.from("broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", broadcastId).in("status", ["pending", "sending"]);
  const remaining = count || 0;
  const patch: Record<string, any> = { sent: b.sent + sentNow, failed: b.failed + failedNow };
  if (!remaining) {
    patch.status = "done";
    patch.finished_at = new Date().toISOString();
  }
  await admin.from("broadcasts").update(patch).eq("id", broadcastId);
  return { remaining, sent: patch.sent, failed: patch.failed, status: patch.status || "sending" };
}

/** One message to you, with the made-up name "Chula". */
export async function sendBroadcastTest(m: Message, to: { email?: string | null; phone?: string | null }) {
  const admin: any = supabaseAdmin();
  const [settings, liveLink] = await Promise.all([loadSettings(admin), currentLiveLink(admin)]);
  const out: { email?: string; sms?: string } = {};
  if (to.email) {
    try {
      const card = m.attach_card_email ? await contactCard() : null;
      const msg = { ...m, email_subject: "[PRUEBA] " + m.email_subject };
      await sendOne({ channel: "email", to: to.email, name: "Chula" }, msg, settings, liveLink, card);
      out.email = "sent";
    } catch (e: any) {
      out.email = e?.message || "failed";
    }
  }
  if (to.phone) {
    const ph = toE164(to.phone);
    if (!ph) out.sms = "That phone number doesn't look right.";
    else {
      try {
        await sendOne({ channel: "sms", to: ph, name: "Chula" }, m, settings, liveLink, null);
        out.sms = "sent";
      } catch (e: any) {
        out.sms = e?.message || "failed";
      }
    }
  }
  return out;
}
