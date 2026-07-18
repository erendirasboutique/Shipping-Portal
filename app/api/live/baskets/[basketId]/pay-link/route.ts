import { NextResponse } from 'next/server';
import { getBasketDetail } from '@/lib/live/queries';

export const dynamic = 'force-dynamic';

type Ctx = { params: { basketId: string } };

/**
 * Get a Stripe Checkout URL for this basket's current total.
 *
 * The shipping portal has the basket but not the Stripe keys, so it asks
 * the billing portal (which has the keys) to mint a session, over the same
 * shared-secret bridge as the baskets feed. Card + BNPL (Klarna, Affirm,
 * Afterpay, Zip) are chosen by Stripe from the amount — no method code here.
 *
 * Env: LIVE_CHECKOUT_URL (billing portal base) + LIVE_API_SECRET.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const basket = await getBasketDetail(params.basketId);
    if (!basket) return NextResponse.json({ error: 'Basket not found' }, { status: 404 });
    if (basket.total_cents <= 0) {
      return NextResponse.json({ error: 'Basket has no balance.' }, { status: 400 });
    }

    const base = (process.env.LIVE_CHECKOUT_URL || 'https://my.erendirasboutique.com').replace(/\/+$/, '');
    const secret = process.env.LIVE_API_SECRET;
    if (!secret) return NextResponse.json({ error: 'LIVE_API_SECRET not set' }, { status: 500 });

    const res = await fetch(`${base}/api/live-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-live-secret': secret },
      cache: 'no-store',
      body: JSON.stringify({
        amount_cents: basket.total_cents,
        label: `Canasta #${basket.basket_number} — Erendira's Boutique`,
        email: basket.customer?.email ?? undefined,
      }),
    });

    const json = await res.json();
    if (!res.ok) return NextResponse.json({ error: json.error ?? 'Checkout failed' }, { status: 502 });

    return NextResponse.json({ url: json.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
