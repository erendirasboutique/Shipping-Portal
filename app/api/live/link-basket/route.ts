import { NextResponse } from 'next/server';
import { findBasketByNumberInLatestSale, linkBasketToOrder } from '@/lib/live/orders';

export const dynamic = 'force-dynamic';

/**
 * Link a basket (by number, in the most recent live sale) to a shipping
 * order. Called by the create-label page after it saves the order.
 *
 * This is an internal staff route — the create-label page is already behind
 * the staff login, so no shared secret here. Not under /external.
 *
 * Body: { basket_number, order_id, by? }
 *
 * Returns { linked: false } rather than erroring when no basket matches:
 * the label is already bought, and a missing link isn't a failure worth
 * blocking the ship on.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = typeof body.order_id === 'string' ? body.order_id : null;
    if (!orderId) {
      return NextResponse.json({ error: 'order_id required' }, { status: 400 });
    }

    // Two ways in: a direct basket_id (the drawer's "attach" picker) or a
    // basket_number resolved against the latest sale (the create-label
    // page). basket_id wins if both are present.
    let basketId: string | null =
      typeof body.basket_id === 'string' ? body.basket_id : null;

    if (!basketId) {
      const basketNumber = Number(body.basket_number);
      if (!Number.isInteger(basketNumber) || basketNumber < 1) {
        return NextResponse.json(
          { error: 'basket_id or basket_number required' },
          { status: 400 }
        );
      }
      const basket = await findBasketByNumberInLatestSale(basketNumber);
      if (!basket) {
        return NextResponse.json({
          linked: false,
          reason: 'No basket with that number in the most recent live sale.',
        });
      }
      basketId = basket.id;
    }

    await linkBasketToOrder({
      basketId,
      orderId,
      actor: typeof body.by === 'string' ? body.by : undefined,
    });

    return NextResponse.json({ linked: true, basket_id: basketId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
