/**
 * dub.co short links for customer portal links.
 *
 * A customer's portal link (order.erendirasboutique.com/{token}) shows all
 * their baskets, so the short link is per-CUSTOMER, made once and reused for
 * every future live. We store it on shipping_customers.portal_short_url.
 *
 * dub's externalId gives us idempotency for free: tag the link with the
 * customer's id, and if we ask again dub returns the same link instead of
 * making a duplicate. So even if the stored copy is somehow lost, we never
 * pile up links for one customer.
 *
 * The API key is server-only. This module is only ever imported by API
 * routes — never ship it to the browser.
 */

const DUB_BASE = 'https://api.dub.co';

export async function ensureShortLink(opts: {
  customerId: string;
  longUrl: string;
}): Promise<string | null> {
  const key = process.env.DUB_API_KEY;
  if (!key) {
    // No key configured — caller falls back to the long URL. Not an error
    // worth throwing over; the long link works fine.
    return null;
  }

  try {
    const res = await fetch(`${DUB_BASE}/links`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: opts.longUrl,
        // Idempotency key: one link per customer, forever.
        externalId: `ext_cust_${opts.customerId}`,
      }),
      cache: 'no-store',
    });

    // dub returns 409 if a link with this externalId already exists. Fetch
    // and return the existing one rather than treating it as a failure.
    if (res.status === 409) {
      const existing = await fetch(
        `${DUB_BASE}/links/external/${encodeURIComponent(`ext_cust_${opts.customerId}`)}`,
        { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' }
      );
      if (existing.ok) {
        const json = await existing.json();
        return json.shortLink ?? null;
      }
      return null;
    }

    if (!res.ok) return null;

    const json = await res.json();
    return json.shortLink ?? null;
  } catch {
    return null;
  }
}
