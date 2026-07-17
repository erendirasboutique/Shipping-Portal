import { NextResponse } from 'next/server';
import { getBasketsForSale, getBasketTotals } from '@/lib/live/queries';

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
