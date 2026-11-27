// lib/payments/inbound.ts
// Server-only helpers for payments read from forwarded emails.
//
//   pay@shoperendirasboutique.com  --(Gmail filter: Venmo, PayPal, Cash App)--+
//   hello@erendirasboutique.com    --(Gmail filter: Wells Fargo Zelle)--------+--> <anything>@corauxtro.resend.app
//                                                                              |
//   Resend "email.received" webhook --> /api/webhooks/resend-inbound ----------+
//     -> read the email -> who paid, how much, the note -> inbound_payments (status "new")
//   Friday: /pagos suggests the basket, a person taps Confirmar.

import crypto from "crypto";

export type Source = "venmo" | "paypal" | "cashapp" | "zelle" | "gmail_confirm";

export type Parsed = {
  source: Source;
  payerName: string | null;
  amountCents: number | null;
  note: string | null;
  reference: string | null;
  paidOn: string | null;
  /** Gmail forwarding confirmation code, when source is gmail_confirm. */
  code?: string | null;
};

/* ---------------- webhook signature (Svix, which Resend uses) ---------------- */

/** True when the svix-* headers prove Resend sent this exact body. */
export function verifyResendSignature(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature || !secret) return false;

  // Refuse old or future messages (replays).
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 5 * 60) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();

  // Header looks like "v1,BASE64 v1,BASE64" (several during key rotation).
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

/* ---------------- who sent it ---------------- */

const SENDERS: { source: Source; addresses: string[]; domain: string }[] = [
  { source: "venmo", addresses: ["venmo@venmo.com"], domain: "venmo.com" },
  { source: "paypal", addresses: ["service@paypal.com"], domain: "paypal.com" },
  { source: "cashapp", addresses: ["cash@square.com", "noreply@notifications.cash.app"], domain: "" },
  { source: "zelle", addresses: ["alerts@notify.wellsfargo.com"], domain: "wellsfargo.com" },
  { source: "gmail_confirm", addresses: ["forwarding-noreply@google.com"], domain: "google.com" },
];

/** The bare address out of "Venmo <venmo@venmo.com>" or "venmo@venmo.com". */
export function bareAddress(from: string | null | undefined): string {
  const s = String(from || "").trim().toLowerCase();
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim();
}

export function sourceFor(from: string | null | undefined): { source: Source; domain: string } | null {
  const addr = bareAddress(from);
  for (const s of SENDERS) {
    if (s.addresses.includes(addr)) {
      return { source: s.source, domain: s.domain || addr.split("@")[1] || "" };
    }
  }
  return null;
}

/**
 * Did the original sender's domain sign this email (DKIM / DMARC pass)?
 * Resend reports SPF/DKIM/DMARC on the received email. A forward breaks
 * SPF but normally keeps the original DKIM signature, so we look for a
 * DKIM or DMARC pass that mentions the sender's domain.
 *   "pass"    -> signed by Venmo/PayPal/...
 *   "fail"    -> it says it's from them but the signature failed (likely fake)
 *   "unknown" -> Resend didn't report it; a person still has to confirm
 */
export function authStatus(authentication: unknown, domain: string): "pass" | "fail" | "unknown" {
  if (!authentication || !domain) return "unknown";
  const flat = JSON.stringify(authentication).toLowerCase();
  const d = domain.toLowerCase();
  const root = d.split(".").slice(-2).join(".");
  const mentions = flat.includes(d) || flat.includes(root);

  const pick = (key: string): string | null => {
    const m = flat.match(new RegExp('"' + key + '"\\s*:\\s*(\\{[^}]*\\}|"[a-z]+")'));
    return m ? m[1] : null;
  };
  const dkim = pick("dkim");
  const dmarc = pick("dmarc");
  const passes = (v: string | null) => !!v && /pass/.test(v) && !/fail/.test(v);
  const fails = (v: string | null) => !!v && /fail/.test(v) && !/pass/.test(v);

  if ((passes(dkim) || passes(dmarc)) && mentions) return "pass";
  if (fails(dkim) && fails(dmarc)) return "fail";
  return "unknown";
}

/** Which of our inboxes forwarded it (Gmail adds X-Forwarded-For / -To). */
export function forwardedBy(headers: unknown, allowed: string[]): string | null {
  const flat = JSON.stringify(headers || "").toLowerCase();
  return allowed.find((a) => a && flat.includes(a.toLowerCase())) || null;
}

/* ---------------- reading the email ---------------- */

/** HTML -> plain lines, for emails without a text part. */
export function htmlToText(html: string): string {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|th|h[1-6]|li|table|span)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&rsquo;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&[a-z#0-9]+;/gi, " ");
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function toCents(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

const MONEY = "\\$\\s?([0-9][0-9,]*(?:\\.[0-9]{2})?)";

function clean(s: string | null | undefined): string | null {
  const v = String(s || "").replace(/\s+/g, " ").trim();
  return v ? v.slice(0, 160) : null;
}

/** "MARIA SANTOS LANDEROS" -> "Maria Santos Landeros" (Zelle shouts). */
function niceName(s: string | null): string | null {
  if (!s) return null;
  if (s === s.toUpperCase()) {
    return s.toLowerCase().replace(/(^|[\s'-])([a-z\u00e0-\u00ff])/g, (_m: string, a: string, b: string) => a + b.toUpperCase());
  }
  return s;
}

export function parsePaymentEmail(source: Source, subject: string, text: string): Parsed {
  const all = String(text || "");
  const ls = lines(all);
  const out: Parsed = { source, payerName: null, amountCents: null, note: null, reference: null, paidOn: null };

  if (source === "gmail_confirm") {
    const code = all.match(/Confirmation code:\s*([0-9]{6,12})/i) || all.match(/\b([0-9]{9})\b/);
    out.code = code ? code[1] : null;
    return out;
  }

  if (source === "venmo") {
    // Subject: "Claudia Montes De Oca paid you $50.00"
    const m = (subject.match(new RegExp("^(.+?) paid you " + MONEY, "i")) ||
      all.match(new RegExp("([^\\n]+?) paid you\\s*" + MONEY, "i")));
    if (m) { out.payerName = clean(m[1]); out.amountCents = toCents(m[2]); }
    if (!out.amountCents) {
      const a = all.match(new RegExp(MONEY));
      out.amountCents = a ? toCents(a[1]) : null;
    }
    // The note is the first line after the amount that isn't a button or label.
    const i = ls.findIndex((l) => /paid you/i.test(l));
    if (i >= 0) {
      const skip = /^\$|^[0-9.,\s$]+$|see transaction|money credited|transaction details|^date$/i;
      const after = ls.slice(i + 1, i + 6).find((l) => !skip.test(l) && !/paid you/i.test(l));
      out.note = clean(after);
    }
    const ref = all.match(/Transaction ID\s*:?\s*([0-9]{6,})/i);
    out.reference = ref ? ref[1] : null;
    const d = all.match(/Date\s*:?\s*([A-Z][a-z]{2} \d{1,2}, \d{4})/);
    out.paidOn = d ? d[1] : null;
    return out;
  }

  if (source === "paypal") {
    // "Claudia Garcia sent you $65.00 USD" (sometimes after "Hello, Erendira's Boutique LLC")
    const m = all.match(new RegExp("(?:Hello,[^\\n]*?LLC\\s+)?([A-Za-zÀ-ÿ'.\\- ]{2,80}?) sent you " + MONEY, "i"));
    if (m) { out.payerName = clean(m[1]); out.amountCents = toCents(m[2]); }
    const received = all.match(new RegExp("Money received\\s*" + MONEY, "i"));
    if (received) out.amountCents = toCents(received[1]); // before PayPal's fee
    const ref = all.match(/Transaction ID\s*:?\s*([A-Z0-9]{10,})/i);
    out.reference = ref ? ref[1] : null;
    const d = all.match(/Transaction date\s*:?\s*([A-Z][a-z]+ \d{1,2}, \d{4})/i);
    out.paidOn = d ? d[1] : null;
    const note = all.match(/(?:Note from [^:\n]+|Message)\s*:?\s*\n?\s*([^\n]{1,120})/i);
    out.note = note ? clean(note[1]) : null;
    return out;
  }

  if (source === "cashapp") {
    const sender = all.match(/Sender:\s*([^\n]+)/i);
    out.payerName = sender ? clean(sender[1]) : null;
    const amt = all.match(new RegExp("\\+\\s?" + MONEY)) || all.match(new RegExp(MONEY));
    out.amountCents = amt ? toCents(amt[1]) : null;
    const forLine = ls.find((l) => /^For\b/i.test(l));
    out.note = forLine ? clean(forLine.replace(/^For\s*/i, "")) : null;
    const ref = all.match(/Transaction number\s*#?\s*([A-Z0-9-]{5,})/i) || all.match(/#(D-[A-Z0-9]+)/);
    out.reference = ref ? ref[1] : null;
    return out;
  }

  if (source === "zelle") {
    // "MARIA SANTOS LANDEROS sent you $28.00"
    const m = all.match(new RegExp("([A-Za-zÀ-ÿ'.\\- ]{2,80}?) sent you\\s*" + MONEY, "i"));
    if (m) { out.payerName = niceName(clean(m[1])); out.amountCents = toCents(m[2]); }
    const conf = all.match(/Confirmation\s*:?\s*([A-Za-z0-9]{6,})/i);
    out.reference = conf ? conf[1] : null;
    const memo = all.match(/Memo\s*:?\s*([^\n]+)/i);
    out.note = memo ? clean(memo[1]) : null;
    const d = all.match(/Date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    out.paidOn = d ? d[1] : null;
    return out;
  }

  return out;
}

/* ---------------- matching a payment to a basket ---------------- */

export type OpenBasket = {
  id: string;
  basket_number: number;
  total_cents: number;
  customer_name: string | null;
  sale_title: string | null;
  sale_date: string | null;
  status: string;
};

export type Suggestion = OpenBasket & { score: number; why: string[] };

function norm(s: string | null | undefined): string[] {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Best baskets for one payment, best first. */
export function suggest(
  payment: { payer_name: string | null; amount_cents: number | null; note: string | null },
  baskets: OpenBasket[],
  max = 3
): Suggestion[] {
  const payer = norm(payment.payer_name);
  const noteNum = String(payment.note || "").match(/#\s?(\d{1,4})\b/);

  return baskets
    .map((b) => {
      let score = 0;
      const why: string[] = [];
      if (noteNum && Number(noteNum[1]) === b.basket_number) {
        score += 100;
        why.push("número en la nota");
      }
      if (payment.amount_cents != null && payment.amount_cents === b.total_cents) {
        score += 50;
        why.push("mismo total");
      }
      const cust = norm(b.customer_name);
      if (payer.length && cust.length) {
        const full = cust.filter((w) => w.length > 1);
        const initials = cust.filter((w) => w.length === 1);
        const shared = full.filter((w) => payer.includes(w)).length;
        if (cust[0] && payer[0] === cust[0]) {
          score += 25;
          why.push("mismo nombre");
        } else if (shared) {
          score += 10;
        }
        if (shared >= 2) {
          score += 20;
          why.push("mismo apellido");
        } else if (initials.length && payer.slice(1).some((w) => initials.includes(w[0]))) {
          score += 10; // "Ana R." and "Ana Rodriguez"
        }
      }
      return { ...b, score, why };
    })
    .filter((s) => s.score >= 35)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}
