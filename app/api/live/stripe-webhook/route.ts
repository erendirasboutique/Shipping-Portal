import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { liveDb } from '@/lib/live/supabase';

export const dynamic = 'force-dynamic';

/**
 * Marks a basket paid the moment Stripe says so — nobody watches for
 * payments on Friday.
 *
 * If you already have a Stripe webhook route, DON'T add a second
 * endpoint in Stripe. Instead copy the markBasketPaid() call below into
 * your existing checkout.session.completed handler and delete this file.
 *
 * Otherwise: Stripe Dashboard → Developers → Webhooks → add endpoint
 *   URL:    https://<your-domain>/api/live/stripe-webhook
 *   Events: checkout.session.completed
 * Then put the signing secret in STRIPE_LIVE_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_LIVE_WEBHOOK_SECRET;

  if (!secret || !webhookSecret) {
    return NextResponse.json(
      { error: 'Stripe keys are not set in this environment.' },
      { status: 500 }
    );
  }

  const stripe = new Stripe(secret);
  const signature = req.headers.get('stripe-signature');
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature ?? '', webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Signature check failed: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const basketId = session.metadata?.basket_id;

    if (basketId) {
      await markBasketPaid(basketId);
    }
  }

  return NextResponse.json({ received: true });
}

/** The one line to copy if you're merging this into an existing webhook. */
export async function markBasketPaid(basketId: string) {
  const { error } = await liveDb()
    .from('baskets')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', basketId)
    .neq('status', 'paid');

  if (error) console.error('[live] could not mark basket paid', basketId, error.message);
}
