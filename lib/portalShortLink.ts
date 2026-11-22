// lib/portalShortLink.ts  (server only: uses DUB_API_KEY)
//
// Short links for a customer's account portal (my.erendirasboutique.com/account?t=TOKEN)
// on the my.ebtq.io domain. Made the first time someone presses "Copy portal link"
// for that customer, saved on shipping_customers.account_short_url, and reused after.
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

export type ShortLinkResult = { shortLink: string } | { error: string };

export async function createAccountShortLink(customerId: string, token: string): Promise<ShortLinkResult> {
  const key = process.env.DUB_API_KEY;
  if (!key) return { error: "DUB_API_KEY isn't set in Vercel." };
  const headers = { Authorization: "Bearer " + key, "Content-Type": "application/json" };

  try {
    const res = await fetch(DUB_BASE + "/links", {
      method: "POST",
      headers,
      body: JSON.stringify({
        url: accountPortalUrl(token),
        domain: domain(),
        externalId: externalId(customerId),
      }),
      cache: "no-store",
    });
    const json: any = await res.json().catch(() => null);
    if (res.ok && json?.shortLink) return { shortLink: json.shortLink };

    // Already made for this customer (e.g. saved copy lost): fetch the existing one.
    // Dub wants the external id prefixed with "ext_" when it's in the query string.
    if (res.status === 409) {
      const found = await fetch(
        DUB_BASE + "/links/info?externalId=" + encodeURIComponent("ext_" + externalId(customerId)),
        { headers, cache: "no-store" }
      );
      const existing: any = await found.json().catch(() => null);
      if (found.ok && existing?.shortLink) return { shortLink: existing.shortLink };
    }

    return { error: json?.error?.message || "Dub couldn't make the link (" + res.status + ")." };
  } catch {
    return { error: "Couldn't reach Dub." };
  }
}
