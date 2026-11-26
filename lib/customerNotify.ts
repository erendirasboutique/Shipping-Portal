// lib/customerNotify.ts
// Server only. The 4 customer notifications (bilingual email + text):
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

export type Template = {
  stage: Stage;
  email_enabled: boolean;
  sms_enabled: boolean;
  subject: string;
  heading_es: string;
  heading_en: string;
  body_es: string;
  body_en: string;
  sms_body: string;
};

export type Settings = {
  enabled: boolean;
  enabled_since: string | null;
  logo_url: string | null;
  tagline: string | null;
  business_address: string | null;
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
  color_background: "#F5F3EF",
  color_accent: "#957f67",
  color_border: "#cfbda9",
  color_text: "#332b23",
};

export const VARIABLES = [
  "first_name",
  "order_number",
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

function firstName(name: string | null | undefined) {
  const n = (name || "").trim().split(/\s+/)[0] || "";
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : "";
}

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAYS_ES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  const wd = DAYS_EN.indexOf(get("weekday"));
  return { y: +get("year"), m: +get("month") - 1, d: +get("day"), wd, time: `${get("hour")}:${get("minute")} ${get("dayPeriod")}` };
}

/** "sáb 28 nov · Sat, Nov 28" */
function bilingualDate(d: Date, withTime = false) {
  const p = laParts(d);
  const base = `${DAYS_ES[p.wd]} ${p.d} ${MONTHS_ES[p.m]} · ${DAYS_EN[p.wd]}, ${MONTHS_EN[p.m]} ${p.d}`;
  return withTime ? `${base} · ${p.time}` : base;
}

/** The ship date: today if it's Saturday, otherwise the coming Saturday. */
function nextShipDay(from: Date) {
  const p = laParts(from);
  const add = (6 - p.wd + 7) % 7;
  return new Date(from.getTime() + add * 86400000);
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

export function varsForOrder(order: any): Vars {
  const now = new Date();
  const addr = [order.to_street1, [order.to_city, order.to_state].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  const eta = order.tracking_eta ? bilingualDate(new Date(order.tracking_eta)) : "";
  const delivered = order.delivered_at ? bilingualDate(new Date(order.delivered_at), true) : "";
  return {
    first_name: firstName(order.to_name),
    order_number: order.order_number != null ? "#EB-" + order.order_number : "",
    ship_date: bilingualDate(nextShipDay(now)),
    eta,
    carrier: [order.carrier, order.mail_class].filter(Boolean).join(" "),
    tracking_number: order.tracking_number || "",
    tracking_link: order.tracking_number ? trackingLink(order.tracking_number) : "",
    address: addr,
    scan_location: order.tracking_last_location || "",
    delivered_time: delivered,
  };
}

/** Made-up order for previews and test sends. */
export const SAMPLE_VARS: Vars = {
  first_name: "Maria",
  order_number: "#EB-24",
  ship_date: "sáb 28 nov · Sat, Nov 28",
  eta: "mar 1 dic · Tue, Dec 1",
  carrier: "USPS GroundAdvantage",
  tracking_number: "9400111122334455667788",
  tracking_link: "https://track.erendirasboutique.com/?tracking=9400111122334455667788",
  address: "1234 Rosewood Ave, Anaheim, CA",
  scan_location: "Los Angeles, CA",
  delivered_time: "mar 1 dic · Tue, Dec 1 · 2:37 PM",
};

// ---------------------------------------------------------------- email HTML

const STEP_LABELS: [string, string][] = [
  ["Empacado", "Packed"],
  ["En camino", "On the way"],
  ["Sale a entrega", "Out for delivery"],
  ["Entregado", "Delivered"],
];

/** Builds the branded, bilingual email. Table layout + inline styles so it looks right in Gmail/Outlook/Apple Mail. */
export function renderEmail(t: Template, s: Settings, vars: Vars): { subject: string; html: string; text: string } {
  const C = {
    bg: safeColor(s.color_background, DEFAULT_SETTINGS.color_background),
    accent: safeColor(s.color_accent, DEFAULT_SETTINGS.color_accent),
    border: safeColor(s.color_border, DEFAULT_SETTINGS.color_border),
    text: safeColor(s.color_text, DEFAULT_SETTINGS.color_text),
  };
  const logo = s.logo_url && /^https:\/\//.test(s.logo_url) ? s.logo_url : SITE + "/logo2.png";
  const HEAD = "'Charman Serif', Georgia, 'Times New Roman', serif";
  const BODY = "'Ltt Recoleta', Georgia, 'Times New Roman', serif";
  const rank = RANK[t.stage];

  const subject = fill(t.subject, vars).replace(/\n/g, " ");
  const headingEs = esc(fill(t.heading_es, vars));
  const headingEn = esc(fill(t.heading_en, vars));
  const para = (txt: string) => esc(fill(txt, vars)).replace(/\n/g, "<br>");

  const steps = STEP_LABELS.map(([es, en], i) => {
    const done = i <= rank;
    const dot = done
      ? `<div style="width:14px;height:14px;border-radius:7px;background:${C.accent};margin:0 auto 6px;"></div>`
      : `<div style="width:10px;height:10px;border-radius:7px;border:2px solid ${C.border};margin:0 auto 6px;"></div>`;
    const w = i === rank ? "font-weight:bold;" : "";
    return `<td width="25%" align="center" valign="top" style="padding:0 2px;font-family:${BODY};font-size:11px;line-height:1.3;color:${done ? C.text : C.accent};${w}">${dot}${es}<br>${en}</td>`;
  }).join("");

  // Big band (stage specific)
  let band = "";
  if (t.stage === "in_transit" && vars.eta) band = bandHtml("Entrega estimada · Estimated delivery", vars.eta);
  if (t.stage === "out_for_delivery") band = bandHtml("Llega hoy · Arriving today", vars.address || "");
  if (t.stage === "delivered" && vars.delivered_time) band = bandHtml("Entregado · Delivered", vars.delivered_time);
  function bandHtml(label: string, value: string) {
    return `<tr><td style="padding:0 32px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.accent};border-radius:14px;"><tr><td align="center" style="padding:22px 16px;font-family:${BODY};color:#ffffff;">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;">${esc(label)}</div>
      <div style="font-family:${HEAD};font-size:22px;line-height:1.3;margin-top:4px;">${esc(value)}</div>
    </td></tr></table></td></tr>`;
  }

  // Details rows
  const rows: [string, string][] = [];
  if (vars.order_number) rows.push(["Pedido · Order", vars.order_number]);
  if (t.stage === "packed" && vars.ship_date) rows.push(["Sale · Ships", vars.ship_date]);
  if (t.stage !== "delivered" && t.stage !== "in_transit" && vars.eta) rows.push(["Llega · Arrives", vars.eta]);
  if (t.stage === "in_transit" && vars.scan_location) rows.push(["Último escaneo · Latest scan", vars.scan_location]);
  if (t.stage !== "out_for_delivery" && vars.address) rows.push(["Envío a · Shipping to", vars.address]);
  if (vars.carrier) rows.push(["Paquetería · Carrier", vars.carrier]);
  if (vars.tracking_number) rows.push(["Rastreo · Tracking", vars.tracking_number]);
  const details = rows.length
    ? `<tr><td style="padding:0 32px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${C.border};border-radius:14px;">${rows
        .map(
          ([k, v], i) =>
            `<tr><td style="padding:13px 18px;${i < rows.length - 1 ? `border-bottom:1px solid ${C.bg};` : ""}font-family:${BODY};font-size:13px;color:${C.accent};">${esc(k)}</td><td align="right" style="padding:13px 18px;${i < rows.length - 1 ? `border-bottom:1px solid ${C.bg};` : ""}font-family:${BODY};font-size:14px;color:${C.text};">${esc(v)}</td></tr>`
        )
        .join("")}</table></td></tr>`
    : "";

  const button = vars.tracking_link
    ? `<tr><td style="padding:0 32px 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:${C.accent};border-radius:12px;">
        <a href="${esc(vars.tracking_link)}" style="display:block;padding:16px;font-family:${BODY};font-size:16px;color:#ffffff;text-decoration:none;">Rastrear mi paquete · Track my package</a>
      </td></tr></table></td></tr>`
    : "";

  let tips = "";
  if (t.stage === "delivered") {
    tips = tipsHtml("¿No lo ves? · Don't see it?", [
      "Revisa alrededor de tu puerta, buzón o con un vecino. · Check around your door, mailbox, or with a neighbor.",
      "A veces USPS lo marca entregado un poco antes. Espera al final del día. · Sometimes USPS marks it early. Give it until the end of the day.",
    ]);
  } else if (t.stage === "out_for_delivery") {
    tips = tipsHtml("Consejos para hoy · Tips for today", [
      "Recógelo pronto para que no se quede afuera. · Grab it soon so it isn't left outside too long.",
      "¿No estás en casa? USPS puede dejar un aviso para recogerlo. · Not home? USPS may leave a notice for pickup or redelivery.",
    ]);
  }
  function tipsHtml(title: string, items: string[]) {
    return `<tr><td style="padding:0 32px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${C.border};border-radius:14px;"><tr><td style="padding:18px 20px;font-family:${BODY};color:${C.text};">
      <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C.accent};margin-bottom:8px;">${esc(title)}</div>
      ${items.map((x) => `<div style="font-size:14px;line-height:1.5;margin-top:6px;">• ${esc(x)}</div>`).join("")}
    </td></tr></table></td></tr>`;
  }

  const footer = `<tr><td align="center" style="padding:28px 32px;background:#ffffff;border-top:1px solid ${C.border};font-family:${BODY};color:${C.text};">
      <img src="${esc(logo)}" alt="Erendira's Boutique" width="140" style="display:block;width:140px;height:auto;margin:0 auto 10px;border:0;">
      ${s.tagline ? `<div style="font-family:${HEAD};font-size:17px;color:${C.accent};margin-bottom:10px;">${esc(s.tagline)}</div>` : ""}
      <div style="font-size:13px;margin-bottom:10px;">
        <a href="https://ebtq.io/messenger" style="color:${C.accent};">Messenger</a> &nbsp;·&nbsp;
        <a href="https://erendirasboutique.com/return-policy" style="color:${C.accent};">Devoluciones · Returns</a> &nbsp;·&nbsp;
        <a href="${esc((process.env.NEXT_PUBLIC_TRACK_URL || "https://track.erendirasboutique.com"))}" style="color:${C.accent};">Rastrear · Track</a>
      </div>
      <div style="font-size:11px;line-height:1.6;color:${C.text};">${s.business_address ? esc(s.business_address) + "<br>" : ""}Recibes esto porque hiciste un pedido con nosotros. · You're getting this because you placed an order with us.</div>
    </td></tr>`;

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
<style>
@font-face{font-family:'Charman Serif';src:url('${SITE}/fonts/CharmanSerif-Regular.otf') format('opentype');}
@font-face{font-family:'Ltt Recoleta';src:url('${SITE}/fonts/LttRecoleta-CondensedMedium.otf') format('opentype');}
</style></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;">${headingEs} · ${headingEn}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.bg};border:1px solid ${C.border};border-radius:16px;overflow:hidden;">
  <tr><td align="center" style="padding:24px 32px;background:#ffffff;border-bottom:1px solid ${C.border};">
    <img src="${esc(logo)}" alt="Erendira's Boutique" width="190" style="display:block;width:190px;height:auto;border:0;">
  </td></tr>
  <tr><td align="center" style="padding:32px 32px 8px;font-family:${BODY};color:${C.text};">
    <h1 style="margin:0 0 12px;font-family:${HEAD};font-weight:normal;font-size:32px;line-height:1.15;color:${C.accent};">${headingEs}</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.55;">${para(t.body_es)}</p>
  </td></tr>
  <tr><td style="padding:0 32px;"><div style="height:1px;background:${C.border};"></div></td></tr>
  <tr><td align="center" style="padding:20px 32px 24px;font-family:${BODY};color:${C.text};">
    <h2 style="margin:0 0 10px;font-family:${HEAD};font-weight:normal;font-size:22px;line-height:1.2;color:${C.accent};">${headingEn}</h2>
    <p style="margin:0;font-size:15px;line-height:1.55;">${para(t.body_en)}</p>
  </td></tr>
  <tr><td style="padding:0 32px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${C.border};border-radius:14px;"><tr><td style="padding:16px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${steps}</tr></table></td></tr></table></td></tr>
  ${band}
  ${details}
  ${button}
  ${tips}
  ${footer}
</table>
</td></tr></table>
</body></html>`;

  const text = [fill(t.heading_es, vars), fill(t.body_es, vars), "", fill(t.heading_en, vars), fill(t.body_en, vars), "", vars.tracking_link ? "Rastrear / Track: " + vars.tracking_link : ""]
    .filter((x) => x !== undefined)
    .join("\n")
    .trim();

  return { subject, html, text };
}

export function renderSms(t: Template, vars: Vars) {
  const body = fill(t.sms_body, vars);
  return body + "\n\nResponde STOP para cancelar · Reply STOP to opt out";
}

// ---------------------------------------------------------------- sending

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<string | null> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text }),
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
    const vars = varsForOrder(order);

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
          const providerId = await sendEmail(email, m.subject, m.html, m.text);
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
        const id = await sendEmail(to.email, "[TEST] " + m.subject, m.html, m.text);
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
        const id = await sendSms(phone, "[TEST] " + renderSms(t, SAMPLE_VARS), null);
        await admin.from("notification_log").insert({ stage, channel: "sms", sent_to: phone, status: "sent", provider_id: id, test: true });
        result.sms = "sent";
      } catch (e: any) {
        result.sms = e?.message || "failed";
      }
    }
  }
  return result;
}
