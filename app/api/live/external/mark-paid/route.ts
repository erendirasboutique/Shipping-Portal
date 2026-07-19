import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { getBasketDetail } from '@/lib/live/queries';
import { createOrderForBasket } from '@/lib/live/orders';
import { recordEvent } from '@/lib/live/timeline';

export const dynamic = 'force-dynamic';

/**
 * Mark a basket paid — called by the billing portal's Stripe webhook after
 * a Checkout session actually completes. Same effect as a staff member
 * hitting "mark paid" by hand: sets paid_at, records the method and Stripe
 * reference, creates the draft shipping order, and logs the timeline event.
 *
 * Auth: the shared secret header, server-to-server. Never called from a
 * browser.
 *
 * Idempotent: Stripe can deliver a webhook more than once. If the basket is
 * already paid, this returns ok without doing it twice (no second order).
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.LIVE_API_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'LIVE_API_SECRET not set' }, { status: 500 });
    }
    if (req.headers.get('x-live-secret') !== secret) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const basketId = typeof body.basket_id === 'string' ? body.basket_id : null;
    const method = typeof body.method === 'string' ? body.method : 'card';
    const reference = typeof body.reference === 'string' ? body.reference : null;

    if (!basketId) {
      return NextResponse.json({ error: 'basket_id is required' }, { status: 400 });
    }

    const basket = await getBasketDetail(basketId);
    if (!basket) {
      return NextResponse.json({ error: 'Basket not found' }, { status: 404 });
    }

    // Already paid — Stripe re-delivered the webhook. Acknowledge and stop,
    // so we don't stamp a second payment or make a duplicate order.
    if (basket.status === 'paid' || basket.status === 'shipped' || basket.paid_at) {
      return NextResponse.json({ ok: true, already: true });
    }

    const { error } = await liveDb()
      .from('baskets')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_by: 'Stripe',
        payment_method: method,
        payment_note: reference ? `Stripe ${reference}` : null,
      })
      .eq('id', basketId);

    if (error) throw new Error(error.message);

    // Draft order for Saturday's label. Non-fatal if it fails — the basket
    // is still paid; the order can be made by hand.
    let orderWarning: string | null = null;
    try {
      await createOrderForBasket(basketId);
    } catch (err: any) {
      orderWarning = err.message;
    }

    await recordEvent({
      basketId,
      kind: 'paid',
      actor: 'Stripe',
      detail: { method, reference, amount_cents: body.amount_cents ?? basket.total_cents },
    });

    return NextResponse.json({ ok: true, ...(orderWarning ? { orderWarning } : {}) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
