import { NextResponse } from 'next/server';
import { getBasketDetail } from '@/lib/live/queries';

export const dynamic = 'force-dynamic';

/**
 * Minimal basket info for the billing portal's payment-complete page:
 * the basket number and the customer's name, by basket id.
 *
 * Auth: the shared secret header. Returns only these two fields on purpose
 * — the confirmation page doesn't need totals or items, and this endpoint
 * is called right after a public payment, so it stays lean.
 */
export async function GET(req: Request) {
  try {
    const secret = process.env.LIVE_API_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'LIVE_API_SECRET not set' }, { status: 500 });
    }
    if (req.headers.get('x-live-secret') !== secret) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
    }

    const basketId = new URL(req.url).searchParams.get('basket_id');
    if (!basketId) {
      return NextResponse.json({ error: 'basket_id required' }, { status: 400 });
    }

    const basket = await getBasketDetail(basketId);
    if (!basket) {
      return NextResponse.json({ error: 'Basket not found' }, { status: 404 });
    }

    return NextResponse.json({
      basket_number: basket.basket_number,
      customer_name: basket.customer?.name ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
