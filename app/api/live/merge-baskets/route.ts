import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { mergeBasketsToOrder, createOrderForBasket } from '@/lib/live/orders';
import { getBasketDetail } from '@/lib/live/queries';

export const dynamic = 'force-dynamic';

/**
 * Merge several baskets into ONE shipping order — one label, one shipment,
 * for a customer who won multiple baskets in the same live.
 *
 * Body: { basket_ids: string[], by? }
 *
 * If none of the baskets already has an order, we create one from the first
 * basket, then point the rest at it. If one already has an order, we merge
 * the others onto that. Staff route, behind the live login.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.basket_ids)
      ? body.basket_ids.filter((x: unknown): x is string => typeof x === 'string')
      : [];
    const by = typeof body.by === 'string' ? body.by : undefined;

    if (ids.length < 2) {
      return NextResponse.json(
        { error: 'Pick at least two baskets to merge.' },
        { status: 400 }
      );
    }

    // All baskets must belong to the same customer — you can't ship two
    // different people in one box.
    const details = await Promise.all(ids.map((id) => getBasketDetail(id)));
    const found = details.filter(Boolean) as NonNullable<(typeof details)[number]>[];
    if (found.length !== ids.length) {
      return NextResponse.json({ error: 'One or more baskets not found.' }, { status: 404 });
    }
    const customerIds = new Set(found.map((b) => b.customer?.id).filter(Boolean));
    if (customerIds.size !== 1) {
      return NextResponse.json(
        { error: 'All baskets must belong to the same customer to merge.' },
        { status: 400 }
      );
    }

    // Find an existing order among them, or make one from the first basket.
    let orderId = found.find((b) => b.order?.id)?.order?.id ?? null;
    if (!orderId) {
      orderId = await createOrderForBasket(found[0].id);
      if (!orderId) {
        return NextResponse.json(
          { error: 'Could not create an order — the customer may be missing an address.' },
          { status: 400 }
        );
      }
    }

    await mergeBasketsToOrder({ basketIds: ids, orderId, actor: by });

    return NextResponse.json({ ok: true, order_id: orderId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
