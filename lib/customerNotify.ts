// lib/customerNotify.ts
// Server only. The 4 customer notifications (Spanish email + text):
//   packed -> in_transit (USPS first scan) -> out_for_delivery -> delivered
//
// Rules:
//   - Email goes to the order's email (or the customer's profile email).
//   - Text goes to the order's phone (or the profile phone), once Twilio is set up.
//   - No email and no phone -> nothing is sent (no Messenger fallback).
//   - Each message goes out once per order (notification_log has a unique index).
//   - Never send an earlier step after a later one went out.
//   - Texts outside 8am–9pm (customer's local time) are scheduled for 8am via Twilio.
//   - The wording, logo, colors and on/off switches come from Settings › Notifications.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { trackingLink } from "@/lib/notify";

export type Stage = "packed" | "in_transit" | "out_for_delivery" | "delivered";
export const STAGES: Stage[] = ["packed", "in_transit", "out_for_delivery", "delivered"];
const RANK: Record<Stage, number> = { packed: 0, in_transit: 1, out_for_delivery: 2, delivered: 3 };

// heading_es / body_es hold the (Spanish) heading and message.
export type Template = {
  stage: Stage;
  email_enabled: boolean;
  sms_enabled: boolean;
  subject: string;
  heading_es: string;
  body_es: string;
  sms_body: string;
};

export type Settings = {
  enabled: boolean;
  enabled_since: string | null;
  logo_url: string | null;
  tagline: string | null;
  business_address: string | null;
  reply_to: string | null;
  color_background: string;
  color_accent: string;
  color_border: string;
  color_text: string;
};

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  enabled_since: null,
  logo_url: null,
  tagline: "¡Envíos cada Sábado!",
  business_address: null,
  reply_to: "hello@erendirasboutique.com",
  color_background: "#F5F3EF",
  color_accent: "#957f67",
  color_border: "#cfbda9",
  color_text: "#332b23",
};

export const VARIABLES = [
  "first_name",
  "customer_name",
  "order_number",
  "live_week",
  "ship_date",
  "eta",
  "carrier",
  "tracking_number",
  "tracking_link",
  "address",
  "scan_location",
  "delivered_time",
] as const;
export type Vars = Partial<Record<(typeof VARIABLES)[number], string>>;

/** EasyPost/Shippo tracking status -> which notification it means. */
export function stageForStatus(status: string | null | undefined): Stage | null {
  switch (status) {
    case "in_transit":
      return "in_transit";
    case "out_for_delivery":
      return "out_for_delivery";
    case "delivered":
      return "delivered";
    default:
      return null;
  }
}

const STORE_URL = (process.env.NEXT_PUBLIC_BRAND_URL || "https://erendirasboutique.com").replace(/\/$/, "");
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://ship.erendirasboutique.com").replace(/\/$/, "");

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}
export function smsConfigured() {
  return !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_MESSAGING_SERVICE_SID;
}

// ---------------------------------------------------------------- helpers

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function safeColor(c: string | null | undefined, fallback: string) {
  return c && /^#[0-9a-fA-F]{3,8}$/.test(c.trim()) ? c.trim() : fallback;
}

function titleCase(name: string | null | undefined) {
  return (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Date parts in Los Angeles time. */
function laParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value || "";
  return { y: +get("year"), m: +get("month") - 1, d: +get("day"), wd: WD_EN.indexOf(get("weekday")), time: `${get("hour")}:${get("minute")} ${get("dayPeriod")}` };
}

/** "sábado 28 de noviembre" (+ ", 2:37 PM") */
function fecha(d: Date, withTime = false) {
  const p = laParts(d);
  const base = `${DAYS[p.wd]} ${p.d} de ${MONTHS[p.m]}`;
  return withTime ? `${base}, ${p.time}` : base;
}

/** The ship date: today if it's Saturday, otherwise the coming Saturday. */
function nextShipDay(from: Date) {
  const p = laParts(from);
  const add = (6 - p.wd + 7) % 7;
  return new Date(from.getTime() + add * 86400000);
}

/** "Semana 4 de noviembre" — which week of the month the live was in. */
function semana(d: Date) {
  const p = laParts(d);
  return `Semana ${Math.ceil(p.d / 7)} de ${MONTHS[p.m]}`;
}

/** Fill {variables}. A line that uses a detail we don't have is left out. */
export function fill(text: string, vars: Vars): string {
  return String(text || "")
    .split("\n")
    .filter((line) => {
      const used = line.match(/\{([a-z_]+)\}/g) || [];
      return used.every((v) => {
        const key = v.slice(1, -1) as keyof Vars;
        return !(VARIABLES as readonly string[]).includes(key) || !!(vars[key] || "").trim();
      });
    })
    .map((line) => line.replace(/\{([a-z_]+)\}/g, (m, k) => (k in vars ? String((vars as any)[k] ?? "") : m)))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------- data

export async function loadSettings(admin: any): Promise<Settings> {
  const { data } = await admin.from("notification_settings").select("*").eq("id", 1).maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data || {}) };
}

export async function loadTemplate(admin: any, stage: Stage): Promise<Template | null> {
  const { data } = await admin.from("notification_templates").select("*").eq("stage", stage).maybeSingle();
  return (data as Template) || null;
}

async function contactFor(admin: any, order: any): Promise<{ email: string | null; phone: string | null }> {
  let email = (order.to_email || "").trim() || null;
  let phone = (order.to_phone || "").trim() || null;
  if ((!email || !phone) && order.customer_id) {
    const { data } = await admin.from("shipping_customers").select("email, phone").eq("id", order.customer_id).maybeSingle();
    if (!email) email = (data?.email || "").trim() || null;
    if (!phone) phone = (data?.phone || "").trim() || null;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = null;
  return { email, phone: toE164(phone) };
}

/** US numbers -> +1XXXXXXXXXX. Anything else that already starts with + is kept. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+") && digits.length >= 10) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return null;
}

/**
 * Everything the messages can use. The name and week come from the Live List
 * row linked to this order (the name as typed from Facebook, and that week's
 * Friday live). No Live List row -> the ship-to name and the order's date.
 */
export async function varsForOrder(admin: any, order: any): Promise<Vars> {
  let liveName: string | null = null;
  let liveDate: Date | null = null;
  try {
    const { data } = await admin.from("live_list").select("name, week_start").eq("order_id", order.id).limit(1).maybeSingle();
    if (data) {
      liveName = data.name || null;
      // week_start is that week's Sunday; the live is Friday.
      if (data.week_start) liveDate = new Date(data.week_start + "T20:00:00Z");
      if (liveDate) liveDate = new Date(liveDate.getTime() + 5 * 86400000);
    }
  } catch {
    /* no Live List table — fall back below */
  }
  const name = titleCase(liveName || order.to_name);
  const when = liveDate || (order.created_at ? new Date(order.created_at) : new Date());
  const addr = [order.to_street1, [order.to_city, order.to_state].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  return {
    first_name: titleCase(order.to_name).split(" ")[0] || name.split(" ")[0] || "",
    customer_name: name,
    order_number: order.order_number != null ? "#EB-" + order.order_number : "",
    live_week: semana(when),
    ship_date: fecha(nextShipDay(new Date())),
    eta: order.tracking_eta ? fecha(new Date(order.tracking_eta)) : "",
    carrier: [order.carrier, order.mail_class].filter(Boolean).join(" "),
    tracking_number: order.tracking_number || "",
    tracking_link: order.tracking_number ? trackingLink(order.tracking_number) : "",
    address: addr,
    scan_location: order.tracking_last_location || "",
    delivered_time: order.delivered_at ? fecha(new Date(order.delivered_at), true) : "",
  };
}

/** Made-up order for previews and test sends. */
export const SAMPLE_VARS: Vars = {
  first_name: "Maria",
  customer_name: "Maria Naranjo",
  order_number: "#EB-24",
  live_week: "Semana 4 de noviembre",
  ship_date: "sábado 28 de noviembre",
  eta: "martes 1 de diciembre",
  carrier: "USPS GroundAdvantage",
  tracking_number: "9400111122334455667788",
  tracking_link: "https://track.erendirasboutique.com/?tracking=9400111122334455667788",
  address: "1234 Rosewood Ave, Anaheim, CA",
  scan_location: "Los Angeles, CA",
  delivered_time: "martes 1 de diciembre, 2:37 PM",
};

// ---------------------------------------------------------------- email HTML

const STEP_LABELS = ["Empacado", "En camino", "Sale a entrega", "Entregado"];
const HEAD = "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
const BODY = "'Avenir Next', Avenir, 'Segoe UI', Helvetica, Arial, sans-serif";

/** The branded Spanish email. Table layout + inline styles so it holds up in Gmail/Outlook/Apple Mail. */
export function renderEmail(t: Template, s: Settings, vars: Vars): { subject: string; html: string; text: string } {
  const accent = safeColor(s.color_accent, DEFAULT_SETTINGS.color_accent);
  const bg = safeColor(s.color_background, DEFAULT_SETTINGS.color_background);
  const ink = safeColor(s.color_text, DEFAULT_SETTINGS.color_text);
  const line = "#EAE4DC";
  const muted = "#6b5f53";
  const logo = s.logo_url && /^https:\/\//.test(s.logo_url) ? s.logo_url : SITE + "/logo2.png";
  const rank = RANK[t.stage];

  const subject = fill(t.subject, vars).replace(/\n/g, " ");
  const heading = esc(fill(t.heading_es, vars));
  const message = esc(fill(t.body_es, vars)).replace(/\n/g, "<br>");

  // Thin 4-part progress bar
  const bars = STEP_LABELS.map((label, i) => {
    const done = i <= rank;
    return `<td width="25%" valign="top" style="padding:0 3px;">
      <div style="height:4px;line-height:4px;font-size:0;border-radius:4px;background:${done ? accent : line};">&nbsp;</div>
      <div style="padding-top:8px;font-family:${BODY};font-size:12px;color:${done ? ink : muted};${i === rank ? "font-weight:600;" : ""}">${label}</div>
    </td>`;
  }).join("");

  // A few key details, by step
  const link = (txt: string) => (vars.tracking_link ? `<a href="${esc(vars.tracking_link)}" style="color:${accent};text-decoration:none;">${esc(txt)}</a>` : esc(txt));
  const rows: [string, string][] = [];
  const tn = vars.tracking_number ? link(vars.tracking_number) : "";
  if (t.stage === "packed") {
    if (vars.ship_date) rows.push(["Fecha de envío", esc(vars.ship_date)]);
    if (vars.carrier) rows.push(["Paquetería", esc(vars.carrier)]);
  }
  if (t.stage === "in_transit") {
    if (vars.eta) rows.push(["Entrega estimada", esc(vars.eta)]);
    if (vars.scan_location) rows.push(["Último escaneo", esc(vars.scan_location)]);
  }
  if (t.stage === "out_for_delivery" && vars.address) rows.push(["Se entrega en", esc(vars.address)]);
  if (t.stage === "delivered" && vars.delivered_time) rows.push(["Entregado", esc(vars.delivered_time)]);
  if (tn) rows.push(["Número de rastreo USPS", tn]);
  const details = rows
    .map(([k, v]) => `<div style="font-family:${BODY};font-size:14px;line-height:1.6;"><span style="color:${muted};">${esc(k)}:</span> <span style="color:${ink};">${v}</span></div>`)
    .join("");

  const tip =
    t.stage === "out_for_delivery"
      ? "¿No estarás en casa? USPS puede dejarte un aviso para recogerlo en tu oficina de correos."
      : t.stage === "delivered"
        ? "¿No lo ves? Revisa alrededor de tu puerta, tu buzón o con un vecino. Si no aparece al final del día, escríbenos."
        : "";
  const tipHtml = tip
    ? `<tr><td style="padding:0 0 28px;"><div style="background:${bg};border-radius:8px;padding:14px 16px;font-family:${BODY};font-size:14px;line-height:1.55;color:${muted};">${esc(tip)}</div></td></tr>`
    : "";

  const itemLine = [vars.customer_name, "Live", vars.live_week].filter(Boolean).join(" · ");
  const items = `<tr><td style="padding:28px 0 0;border-top:1px solid ${line};">
      <div style="font-family:${HEAD};font-size:21px;color:${ink};margin-bottom:14px;">Artículos en este envío</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:${BODY};font-size:15px;font-weight:600;color:${ink};">${esc(itemLine)}</td>
        <td align="right" style="font-family:${BODY};font-size:15px;color:${muted};">× 1</td>
      </tr></table>
    </td></tr>`;

  const replyTo = s.reply_to || DEFAULT_SETTINGS.reply_to || "";
  const footer = `<tr><td style="padding:28px 0 0;">
      <div style="border-top:1px solid ${line};padding-top:24px;font-family:${BODY};font-size:13px;line-height:1.6;color:${muted};">
        ¿Preguntas? Responde a este correo${replyTo ? `, escríbenos a <a href="mailto:${esc(replyTo)}" style="color:${accent};">${esc(replyTo)}</a>` : ""} o por <a href="https://ebtq.io/messenger" style="color:${accent};">Messenger</a>.
        ${s.tagline ? `<div style="font-family:${HEAD};font-size:16px;color:${accent};padding-top:10px;">${esc(s.tagline)}</div>` : ""}
        <div style="font-size:12px;padding-top:10px;">${s.business_address ? esc(s.business_address) + " · " : ""}<a href="https://erendirasboutique.com/return-policy" style="color:${accent};">Política de devoluciones</a></div>
      </div>
    </td></tr>`;

  const button = vars.tracking_link
    ? `<tr><td style="padding:0 0 26px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:${accent};border-radius:8px;"><a href="${esc(vars.tracking_link)}" style="display:inline-block;padding:15px 26px;font-family:${BODY};font-size:16px;font-weight:500;color:#ffffff;text-decoration:none;">${t.stage === "delivered" ? "Ver mi pedido" : "Rastrear mi pedido"}</a></td>
        <td style="padding-left:18px;font-family:${BODY};font-size:14px;color:${muted};">o <a href="${esc(STORE_URL)}" style="color:${accent};text-decoration:none;">Visita nuestra tienda</a></td>
      </tr></table></td></tr>`
    : "";

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${bg};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(fill(t.body_es, vars)).slice(0, 140)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;">
<tr><td style="padding:40px 40px 36px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:0 0 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><img src="${esc(logo)}" alt="Erendira's Boutique" width="170" style="display:block;width:170px;height:auto;border:0;"></td>
      <td align="right" style="font-family:${BODY};font-size:13px;letter-spacing:1px;color:${muted};">${vars.order_number ? "PEDIDO " + esc(vars.order_number) : ""}</td>
    </tr></table></td></tr>
    <tr><td style="padding:0 0 26px;">
      <h1 style="margin:0 0 10px;font-family:${HEAD};font-weight:normal;font-size:30px;line-height:1.2;color:${ink};">${heading}</h1>
      <p style="margin:0;font-family:${BODY};font-size:16px;line-height:1.55;color:${muted};">${message}</p>
    </td></tr>
    <tr><td style="padding:0 0 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -3px;"><tr>${bars}</tr></table></td></tr>
    ${button}
    ${details ? `<tr><td style="padding:0 0 28px;">${details}</td></tr>` : ""}
    ${tipHtml}
    ${items}
    ${footer}
  </table>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    fill(t.heading_es, vars),
    fill(t.body_es, vars),
    "",
    vars.tracking_link ? "Rastrear mi pedido: " + vars.tracking_link : "",
    "",
    itemLine,
  ]
    .join("\n")
    .trim();

  return { subject, html, text };
}

export function renderSms(t: Template, vars: Vars) {
  return fill(t.sms_body, vars) + "\n\nResponde STOP para cancelar.";
}

// ---------------------------------------------------------------- sending

export async function sendEmail(to: string, subject: string, html: string, text: string, replyTo?: string | null): Promise<string | null> {
  const payload: Record<string, any> = { from: process.env.EMAIL_FROM, to: [to], subject, html, text };
  if (replyTo) payload.reply_to = replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Email error (" + res.status + ")");
  return data?.id || null;
}

// US state -> time zone, for texting hours.
const TZ: Record<string, string> = {};
for (const s of "CT DE FL GA IN KY ME MD MA MI NH NJ NY NC OH PA RI SC VT VA WV DC".split(" ")) TZ[s] = "America/New_York";
for (const s of "AL AR IL IA KS LA MN MS MO NE ND OK SD TN TX WI".split(" ")) TZ[s] = "America/Chicago";
for (const s of "CO ID MT NM UT WY".split(" ")) TZ[s] = "America/Denver";
for (const s of "CA NV OR WA".split(" ")) TZ[s] = "America/Los_Angeles";
TZ.AZ = "America/Phoenix";
TZ.AK = "America/Anchorage";
TZ.HI = "Pacific/Honolulu";
TZ.PR = "America/Puerto_Rico";

/** If it's outside 8am–9pm where the customer is, the next 8am (as a Date). Otherwise null = send now. */
export function quietHoursSendAt(state: string | null | undefined, now = new Date()): Date | null {
  const tz = TZ[(state || "").toUpperCase()] || "America/Los_Angeles";
  const hour = +new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(now) % 24;
  if (hour >= 8 && hour < 21) return null;
  const minute = +new Intl.DateTimeFormat("en-US", { timeZone: tz, minute: "numeric" }).format(now);
  const hoursUntil8 = hour >= 21 ? 24 - hour + 8 : 8 - hour;
  return new Date(now.getTime() + (hoursUntil8 * 60 - minute) * 60000 + 2 * 60000);
}

export async function sendSms(to: string, body: string, sendAt: Date | null): Promise<string | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const form = new URLSearchParams({ To: to, Body: body, MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID! });
  if (sendAt) {
    // Twilio needs at least 15 minutes' notice for a scheduled text.
    const t = new Date(Math.max(sendAt.getTime(), Date.now() + 16 * 60000));
    form.set("ScheduleType", "fixed");
    form.set("SendAt", t.toISOString());
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(sid + ":" + process.env.TWILIO_AUTH_TOKEN).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    cache: "no-store",
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Text error (" + res.status + ")");
  return data?.sid || null;
}

/** Claims the (order, stage, channel) slot. False = it was already sent. */
async function claim(admin: any, orderId: string, stage: Stage, channel: "email" | "sms", to: string): Promise<string | null> {
  const { data, error } = await admin
    .from("notification_log")
    .insert({ order_id: orderId, stage, channel, sent_to: to, status: "sending" })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return null; // already sent
    throw new Error(error.message);
  }
  return data.id;
}

export type NotifyResult = { email?: string; sms?: string };

/**
 * Sends one step's email and/or text for an order. Safe to call more than once.
 * Never throws — problems are written to notification_log and returned.
 */
export async function notifyOrder(orderId: string, stage: Stage, opts: { force?: boolean } = {}): Promise<NotifyResult> {
  const out: NotifyResult = {};
  try {
    const admin: any = supabaseAdmin();
    const settings = await loadSettings(admin);
    if (!settings.enabled && !opts.force) return { email: "off", sms: "off" };

    const { data: order } = await admin.from("shipping_orders").select("*").eq("id", orderId).maybeSingle();
    if (!order) return { email: "no order", sms: "no order" };

    // Tracking steps only for orders made after notifications were turned on.
    if (stage !== "packed" && settings.enabled_since && order.created_at && new Date(order.created_at) < new Date(settings.enabled_since) && !opts.force) {
      return { email: "older order", sms: "older order" };
    }

    // Never go backwards (e.g. a late "in transit" after "delivered" already went out).
    const later = STAGES.filter((s) => RANK[s] > RANK[stage]);
    if (later.length) {
      const { data: done } = await admin
        .from("notification_log")
        .select("id")
        .eq("order_id", orderId)
        .in("stage", later)
        .in("status", ["sent", "scheduled", "sending"])
        .eq("test", false)
        .limit(1);
      if (done?.length) return { email: "later step already sent", sms: "later step already sent" };
    }

    const t = await loadTemplate(admin, stage);
    if (!t) return { email: "no template", sms: "no template" };

    const { email, phone } = await contactFor(admin, order);
    if (!email && !phone) return { email: "no contact", sms: "no contact" }; // skip quietly
    const vars = await varsForOrder(admin, order);

    // ----- email
    if (!t.email_enabled) out.email = "off";
    else if (!email) out.email = "no email";
    else if (!emailConfigured()) {
      out.email = "email not set up";
    } else {
      const id = await claim(admin, orderId, stage, "email", email);
      if (!id) out.email = "already sent";
      else {
        try {
          const m = renderEmail(t, settings, vars);
          const providerId = await sendEmail(email, m.subject, m.html, m.text, settings.reply_to);
          await admin.from("notification_log").update({ status: "sent", provider_id: providerId }).eq("id", id);
          out.email = "sent";
        } catch (e: any) {
          await admin.from("notification_log").update({ status: "failed", error: e?.message || "failed" }).eq("id", id);
          out.email = "failed: " + (e?.message || "");
        }
      }
    }

    // ----- text
    if (!t.sms_enabled) out.sms = "off";
    else if (!phone) out.sms = "no phone";
    else if (!smsConfigured()) out.sms = "texting not set up";
    else {
      const id = await claim(admin, orderId, stage, "sms", phone);
      if (!id) out.sms = "already sent";
      else {
        try {
          const sendAt = quietHoursSendAt(order.to_state);
          const providerId = await sendSms(phone, renderSms(t, vars), sendAt);
          await admin.from("notification_log").update({ status: sendAt ? "scheduled" : "sent", provider_id: providerId }).eq("id", id);
          out.sms = sendAt ? "scheduled" : "sent";
        } catch (e: any) {
          await admin.from("notification_log").update({ status: "failed", error: e?.message || "failed" }).eq("id", id);
          out.sms = "failed: " + (e?.message || "");
        }
      }
    }
  } catch (e: any) {
    console.error("[customerNotify]", stage, orderId, e?.message);
    out.email = out.email || "error";
  }
  return out;
}

/** Test send with the made-up order. Logged with test = true. */
export async function sendTest(stage: Stage, to: { email?: string | null; phone?: string | null }) {
  const admin: any = supabaseAdmin();
  const [settings, t] = await Promise.all([loadSettings(admin), loadTemplate(admin, stage)]);
  if (!t) throw new Error("That message isn't set up yet. Run the notifications SQL in Supabase.");
  const result: NotifyResult = {};
  if (to.email) {
    if (!emailConfigured()) result.email = "Email isn't set up (RESEND_API_KEY / EMAIL_FROM).";
    else {
      const m = renderEmail(t, settings, SAMPLE_VARS);
      try {
        const id = await sendEmail(to.email, "[PRUEBA] " + m.subject, m.html, m.text, settings.reply_to);
        await admin.from("notification_log").insert({ stage, channel: "email", sent_to: to.email, status: "sent", provider_id: id, test: true });
        result.email = "sent";
      } catch (e: any) {
        result.email = e?.message || "failed";
      }
    }
  }
  const phone = toE164(to.phone);
  if (to.phone) {
    if (!phone) result.sms = "That phone number doesn't look right.";
    else if (!smsConfigured()) result.sms = "Texting isn't set up yet (Twilio).";
    else {
      try {
        const id = await sendSms(phone, "[PRUEBA] " + renderSms(t, SAMPLE_VARS), null);
        await admin.from("notification_log").insert({ stage, channel: "sms", sent_to: phone, status: "sent", provider_id: id, test: true });
        result.sms = "sent";
      } catch (e: any) {
        result.sms = e?.message || "failed";
      }
    }
  }
  return result;
}
