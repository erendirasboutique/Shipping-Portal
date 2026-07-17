import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { getBasketDetail } from '@/lib/live/queries';

export const dynamic = 'force-dynamic';

type Ctx = { params: { basketId: string } };

/**
 * Locks a basket's total. That's all it does.
 *
 * No Stripe call — payment is manual. After this the customer's portal
 * shows their itemized basket, their total, and how to pay you. When the
 * money actually arrives (Zelle, Cash App, Venmo, cash, whatever), a
 * person marks it paid and records the method.
 *
 * If a particular customer wants a card link, generate one for that
 * basket with the "Stripe link" button — it's per-basket and optional.
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const { basketId } = params;

    const basket = await getBasketDetail(basketId);
    if (!basket) {
      return NextResponse.json({ error: 'Basket not found' }, { status: 404 });
    }
    if (basket.item_count === 0) {
      return NextResponse.json(
        { error: `Basket ${basket.basket_number} is empty.` },
        { status: 400 }
      );
    }
    if (!basket.customer_id) {
      return NextResponse.json(
        {
          error: `Basket ${basket.basket_number} isn't matched to a customer yet — they'd have no portal to open.`,
        },
        { status: 400 }
      );
    }

    const { error } = await liveDb()
      .from('baskets')
      .update({ status: 'finalized', finalized_at: new Date().toISOString() })
      .eq('id', basketId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ basket: await getBasketDetail(basketId) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
