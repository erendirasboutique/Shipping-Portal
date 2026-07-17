import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { liveDb } from '@/lib/live/supabase';
import { getBasketDetail } from '@/lib/live/queries';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ basketId: string }> };

/**
 * One payment link per basket, amount pre-set, metadata carrying
 * basket_id + customer_id so your Stripe webhook can mark it paid
 * without anyone touching it.
 *
 * If you'd rather reuse your existing payment link generator, swap the
 * body of this route for a call into it — the only contract the rest of
 * the module cares about is that it writes stripe_payment_link_url and
 * stripe_payment_link_id back onto the basket.
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { basketId } = await params;

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY is not set in this environment.' },
        { status: 500 }
      );
    }

    const basket = await getBasketDetail(basketId);
    if (!basket) {
      return NextResponse.json({ error: 'Basket not found' }, { status: 404 });
    }
    if (basket.total_cents <= 0) {
      return NextResponse.json(
        { error: 'This basket is empty — nothing to charge.' },
        { status: 400 }
      );
    }
    if (basket.stripe_payment_link_url && basket.status !== 'open') {
      return NextResponse.json({ url: basket.stripe_payment_link_url, reused: true });
    }

    const stripe = new Stripe(secret);

    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: basket.total_cents,
      product_data: {
        name: `Basket ${basket.basket_number} — Erendira's Boutique`,
      },
    });

    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        basket_id: basket.id,
        basket_number: String(basket.basket_number),
        live_sale_id: basket.live_sale_id,
        customer_id: basket.customer_id ?? '',
      },
      payment_intent_data: {
        metadata: {
          basket_id: basket.id,
          basket_number: String(basket.basket_number),
        },
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: basket.customer?.portal_token
            ? `${process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://ship.erendirasboutique.com'}/portal/${basket.customer.portal_token}?paid=1`
            : (process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://erendirasboutique.com'),
        },
      },
    });

    const { error } = await liveDb()
      .from('baskets')
      .update({
        stripe_payment_link_id: link.id,
        stripe_payment_link_url: link.url,
      })
      .eq('id', basketId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ url: link.url, id: link.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
