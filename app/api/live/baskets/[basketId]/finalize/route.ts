import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { getBasketDetail } from '@/lib/live/queries';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ basketId: string }> };

/**
 * Locks a basket's total and mints its payment link. This is the
 * Thursday-night button: after this, the customer's portal shows a
 * total and a Pay button, and nobody types anything.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { basketId } = await params;

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

    // Mint the payment link through the same route the UI uses, so
    // there's exactly one place that talks to Stripe.
    const origin = new URL(req.url).origin;
    const linkRes = await fetch(`${origin}/api/live/baskets/${basketId}/payment-link`, {
      method: 'POST',
    });
    const linkJson = await linkRes.json();

    if (!linkRes.ok) {
      // Finalized but unpayable — surface it rather than pretending.
      return NextResponse.json(
        { basket: await getBasketDetail(basketId), payment_link_error: linkJson.error },
        { status: 207 }
      );
    }

    return NextResponse.json({
      basket: await getBasketDetail(basketId),
      payment_link_url: linkJson.url,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
