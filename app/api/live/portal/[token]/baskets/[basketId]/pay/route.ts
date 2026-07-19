import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { getBasketsForPortalToken } from '@/lib/live/queries';
import { isUuid } from '@/lib/live/schema';

export const dynamic = 'force-dynamic';

type Ctx = { params: { token: string; basketId: string } };

/**
 * Customer-facing "pay this basket" — returns a Stripe Checkout URL.
 *
 * The portal_token is the credential (the customer isn't logged in). We
 * confirm the basket actually belongs to this token before minting
 * anything, so nobody can pay-link a basket that isn't theirs by guessing
 * an id.
 *
 * The shipping portal has no Stripe keys, so it asks the billing portal to
 * create the session, over the shared-secret bridge. Stripe's hosted page
 * then shows card + whatever BNPL (Klarna/Affirm/Afterpay/Zip) the amount
 * qualifies for — enabled once in the Stripe Dashboard, no code per method.
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { token, basketId } = params;
    if (!isUuid(token)) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
    }

    // The basket must belong to this token. getBasketsForPortalToken only
    // returns baskets for this customer, so membership is the check.
    const baskets = await getBasketsForPortalToken(token);
    const basket = baskets.find((b) => b.id === basketId);

    if (!basket) {
      return NextResponse.json({ error: 'Basket not found' }, { status: 404 });
    }
    if (basket.status !== 'finalized') {
      // open = still being built; paid/shipped = nothing to collect.
      return NextResponse.json(
        { error: 'This basket is not ready for payment.' },
        { status: 400 }
      );
    }
    if (basket.total_cents <= 0) {
      return NextResponse.json({ error: 'This basket has no balance.' }, { status: 400 });
    }

    const base = (process.env.LIVE_CHECKOUT_URL || 'https://my.erendirasboutique.com').replace(
      /\/+$/,
      ''
    );
    const secret = process.env.LIVE_API_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Payment is not configured.' }, { status: 500 });
    }

    // Where Stripe sends them after paying. Defaults to a payment-complete
    // page; {CHECKOUT_SESSION_ID} is a Stripe template it fills in on
    // redirect. Payment is confirmed by the webhook, not this redirect —
    // this page is just what the customer sees.
    //
    // Strip any query string the env var might already carry. If
    // LIVE_PAYMENT_COMPLETE_URL is set to ".../payment-complete/en?session_id={CHECKOUT_SESSION_ID}",
    // appending our own ?session_id= would double it — which produced a
    // mangled id Stripe couldn't look up. Take only the path, then add the
    // one session_id ourselves.
    const rawComplete =
      process.env.LIVE_PAYMENT_COMPLETE_URL ||
      'https://my.erendirasboutique.com/payment-complete/en';
    const completeUrl = rawComplete.split('?')[0];
    const portalBase = (
      process.env.NEXT_PUBLIC_PORTAL_URL || 'https://order.erendirasboutique.com'
    ).replace(/\/+$/, '');

    const res = await fetch(`${base}/api/live-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-live-secret': secret },
      cache: 'no-store',
      body: JSON.stringify({
        amount_cents: basket.total_cents,
        label: `Canasta #${basket.basket_number} — ${basket.customer?.name || "Erendira's Boutique"}`,
        email: basket.customer?.email ?? undefined,
        basket_id: basket.id,
        success_url: `${completeUrl}?session_id={CHECKOUT_SESSION_ID}`,
        // If they cancel, back to their portal rather than the pay page.
        cancel_url: `${portalBase}/${token}`,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Pass billing's actual message through — a bare 502 hides whether
      // it's a missing key, a secret mismatch, or a Stripe error.
      return NextResponse.json(
        { error: json.error ?? `Checkout failed (billing returned ${res.status})` },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: json.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
