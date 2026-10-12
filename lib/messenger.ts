// Server-only Messenger helpers.
//
// Two ways a customer gets their package photo:
//   1. Auto-send: the customer messaged the business Page in the last 24 hours,
//      so Facebook lets the Page message them back through the Send API.
//   2. One-tap: everyone else. Their saved chat link opens their chat directly,
//      with the photo already copied.
import crypto from "crypto";

const GRAPH = "https://graph.facebook.com/" + (process.env.FB_GRAPH_VERSION || "v23.0");

// Facebook's window is 24 hours from the customer's last message. Leave a
// little room so a send never lands just after it closes.
const WINDOW_MS = 23.5 * 60 * 60 * 1000;

export function messengerConfigured() {
  return !!process.env.FB_PAGE_ACCESS_TOKEN && !!process.env.FB_APP_SECRET && !!process.env.FB_VERIFY_TOKEN;
}

export function inWindow(lastInboundAt: string | null | undefined) {
  if (!lastInboundAt) return false;
  const t = new Date(lastInboundAt).getTime();
  return Number.isFinite(t) && Date.now() - t < WINDOW_MS;
}

// Why a customer can or can't be sent to automatically, in plain words.
export function autoSendStatus(c: { messenger_psid?: string | null; messenger_last_inbound_at?: string | null } | null) {
  if (!messengerConfigured()) return { ok: false, reason: "Auto-send isn't set up yet." };
  if (!c?.messenger_psid) return { ok: false, reason: "Not linked to a Page chat." };
  if (!inWindow(c.messenger_last_inbound_at)) {
    return { ok: false, reason: "They haven't messaged the Page in the last 24 hours." };
  }
  return { ok: true, reason: "" };
}

// ---------- Chat links ----------

const FB_HOSTS = /(^|\.)(facebook\.com|fb\.com|m\.me|messenger\.com)$/i;
const NOT_A_PROFILE = new Set([
  "messages", "groups", "pages", "events", "marketplace", "watch", "photo", "photo.php",
  "story.php", "permalink.php", "share", "reel", "login", "home.php", "latest", "help",
]);

// Checks a pasted link and works out the address that opens the chat.
export function parseMessengerLink(raw: string): { link: string; openUrl: string } | { error: string } {
  let s = (raw || "").trim();
  if (!s) return { error: "Paste their Facebook or Messenger link." };
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { error: "That doesn't look like a link." };
  }
  if (!FB_HOSTS.test(u.hostname)) return { error: "Use a Facebook or Messenger link for this customer." };
  u.protocol = "https:";
  const link = u.toString();
  return { link, openUrl: chatUrl(u) };
}

function chatUrl(u: URL): string {
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);

  // Already a chat link.
  if (host === "m.me" || host.endsWith(".m.me")) return u.toString();
  if (host.startsWith("business.")) return u.toString();
  if (host.endsWith("messenger.com")) {
    if (parts[0] === "t" && parts[1]) return "https://m.me/" + parts[1];
    if (parts[0] === "e2ee" && parts[1] === "t" && parts[2]) return "https://www.messenger.com/e2ee/t/" + parts[2];
    return u.toString();
  }

  // facebook.com/messages/t/<id>
  if (parts[0] === "messages" && parts[1] === "t" && parts[2]) return "https://m.me/" + parts[2];
  // facebook.com/profile.php?id=123
  if (parts[0] === "profile.php") {
    const id = u.searchParams.get("id");
    return id ? "https://m.me/" + id : u.toString();
  }
  // facebook.com/people/Name/123
  if (parts[0] === "people" && parts[2] && /^\d+$/.test(parts[2])) return "https://m.me/" + parts[2];
  // facebook.com/username
  if (parts.length === 1 && !NOT_A_PROFILE.has(parts[0].toLowerCase())) return "https://m.me/" + parts[0];

  // Share links and anything else: open as-is (their profile, then tap Message).
  return u.toString();
}

export function openUrlFor(link: string | null | undefined): string | null {
  if (!link) return null;
  const p = parseMessengerLink(link);
  return "openUrl" in p ? p.openUrl : null;
}

// ---------- Webhook ----------

export function validSignature(rawBody: string, header: string | null) {
  const secret = process.env.FB_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const want = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const got = header.slice(7);
  if (!/^[0-9a-f]+$/i.test(got) || got.length !== want.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(want, "hex"));
  } catch {
    return false;
  }
}

// The name on the customer's Messenger account, for linking.
export async function profileName(psid: string): Promise<string | null> {
  try {
    const res = await fetch(
      GRAPH + "/" + encodeURIComponent(psid) + "?fields=first_name,last_name,name&access_token=" +
        encodeURIComponent(process.env.FB_PAGE_ACCESS_TOKEN || ""),
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const n = d.name || [d.first_name, d.last_name].filter(Boolean).join(" ");
    return (n || "").trim() || null;
  } catch {
    return null;
  }
}

// ---------- Sending ----------

async function sendOne(psid: string, message: any) {
  const res = await fetch(GRAPH + "/me/messages?access_token=" + encodeURIComponent(process.env.FB_PAGE_ACCESS_TOKEN || ""), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: psid }, messaging_type: "RESPONSE", message }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.error?.code;
    const sub = data?.error?.error_subcode;
    // 10 / 2018278: outside the 24-hour window. 551 / 2018001: can't reach this person.
    if (code === 10 || sub === 2018278) throw new Error("Facebook says the 24-hour window has closed for this customer.");
    if (code === 551 || sub === 2018001) throw new Error("Facebook says this person can't be messaged right now.");
    throw new Error(data?.error?.message || "Messenger error (" + res.status + ")");
  }
  return data;
}

// Photo first, then the message with the tracking link.
export async function sendPackageMessage(psid: string, photoUrl: string, text: string) {
  await sendOne(psid, { attachment: { type: "image", payload: { url: photoUrl, is_reusable: false } } });
  await sendOne(psid, { text });
}
