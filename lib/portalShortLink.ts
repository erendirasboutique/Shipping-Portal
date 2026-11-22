// lib/portalShortLink.ts  (server only: uses DUB_API_KEY)
//
// Short links for a customer's account portal (my.erendirasboutique.com/account?t=TOKEN)
// on the my.ebtq.io domain, shaped like my.ebtq.io/dm42: the customer's initials plus
// two random digits. Made the first time someone presses "Copy portal link" for that
// customer, saved on shipping_customers.account_short_url, and reused after.
//
// Separate from lib/live/shortlink.ts, which shortens the live-sale basket page
// (order.erendirasboutique.com/{token}) into portal_short_url.

const DUB_BASE = "https://api.dub.co";

export const ACCOUNT_PORTAL_BASE = "https://my.erendirasboutique.com/account?t=";

export function accountPortalUrl(token: string) {
  return ACCOUNT_PORTAL_BASE + token;
}

function domain() {
  return (process.env.DUB_PORTAL_DOMAIN || "my.ebtq.io").replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

// One Dub link per customer: tagged with this id so a repeat request finds the
// same link instead of making a duplicate.
function externalId(customerId: string) {
  return "acct_cust_" + customerId;
}

// "Dylan Montoya" -> "dm", "José Ángel Ruiz" -> "jr", "Erendira" -> "er".
export function initialsFor(name: string | null | undefined): string {
  const words = String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) return words[0][0] + words[words.length - 1][0];
  if (words.length === 1) return words[0].slice(0, 2);
  return "c";
}

// Every two-digit ending, in random order, then three-digit ones in case a
// pair of initials has used up all 100.
function candidateKeys(initials: string): string[] {
  const shuffle = (xs: string[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  };
  const two = shuffle(Array.from({ length: 100 }, (_, n) => String(n).padStart(2, "0")));
  const three = shuffle(Array.from({ length: 900 }, (_, n) => String(n + 100)));
  return [...two.slice(0, 12), ...three.slice(0, 6)].map((d) => initials + d);
}

export type ShortLinkResult = { shortLink: string } | { error: string };

export async function createAccountShortLink(customerId: string, token: string, name: string | null): Promise<ShortLinkResult> {
  const apiKey = process.env.DUB_API_KEY;
  if (!apiKey) return { error: "DUB_API_KEY isn't set in Vercel." };
  const headers = { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" };

  // Already made for this customer (e.g. saved copy lost)? Reuse it.
  // Dub wants the external id prefixed with "ext_" when it's in the query string.
  async function existing(): Promise<string | null> {
    const r = await fetch(DUB_BASE + "/links/info?externalId=" + encodeURIComponent("ext_" + externalId(customerId)), {
      headers,
      cache: "no-store",
    });
    const j: any = await r.json().catch(() => null);
    return r.ok && j?.shortLink ? j.shortLink : null;
  }

  try {
    let lastError = "";
    for (const key of candidateKeys(initialsFor(name))) {
      const res = await fetch(DUB_BASE + "/links", {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: accountPortalUrl(token),
          domain: domain(),
          key,
          externalId: externalId(customerId),
        }),
        cache: "no-store",
      });
      const json: any = await res.json().catch(() => null);
      if (res.ok && json?.shortLink) return { shortLink: json.shortLink };

      lastError = json?.error?.message || "Dub couldn't make the link (" + res.status + ").";
      // 409: either this customer already has a link, or someone else has this
      // slug. Check the first; otherwise try the next slug.
      if (res.status === 409 || /already exists|duplicate|taken/i.test(lastError)) {
        const found = await existing();
        if (found) return { shortLink: found };
        continue;
      }
      // A different error (bad key, domain not set up, ...) won't fix itself.
      break;
    }
    return { error: lastError || "No free short link left for these initials." };
  } catch {
    return { error: "Couldn't reach Dub." };
  }
}
