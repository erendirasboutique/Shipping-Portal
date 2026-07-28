import { NextResponse } from 'next/server';
import { getBasketsForSale, getBasketTotals, ensureBasket, getBasketDetail } from '@/lib/live/queries';

export const dynamic = 'force-dynamic';

type Ctx = { params: { saleId: string } };

/**
 * ?detail=1 returns full baskets — items, customer, totals, order — which
 * is what the basket wall renders. Built from the baskets table in five
 * queries, not one per basket.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { saleId } = params;
    const detail = new URL(req.url).searchParams.get('detail');

    if (detail !== '1') {
      return NextResponse.json({ baskets: await getBasketTotals(saleId) });
    }

    return NextResponse.json({ baskets: await getBasketsForSale(saleId) });
  } catch (err: any) {
    // Report it. The previous version filtered failures into an empty
    // array, which is how "no baskets yet" hid a real error for hours.
    return NextResponse.json({ error: err.message, baskets: [] }, { status: 500 });
  }
}

/**
 * Create (or return) a basket by number. Used by quick mode, where you open
 * a basket number and type a total rather than claiming items into it.
 * Idempotent — ensureBasket returns the existing row if the number's taken.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const body = await req.json().catch(() => ({}));
    const n = Number(body.basket_number);
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: 'A basket number is required.' }, { status: 400 });
    }
    const by = typeof body.by === 'string' ? body.by : null;
    const basket = await ensureBasket(params.saleId, n, by);
    const detail = await getBasketDetail(basket.id);
    return NextResponse.json({ basket: detail });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
