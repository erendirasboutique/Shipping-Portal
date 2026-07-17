import { NextResponse } from 'next/server';
import { getBasketDetail, getBasketTotals } from '@/lib/live/queries';
import type { BasketDetail } from '@/types/live';

export const dynamic = 'force-dynamic';

type Ctx = { params: { saleId: string } };

/**
 * ?detail=1 returns full baskets — items, customer, totals — which is what
 * the basket wall needs to render a tile without a second round trip per
 * basket. Without the flag you get just the totals view, which is cheaper
 * if all you want is a count.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { saleId } = params;
    const detail = new URL(req.url).searchParams.get('detail');

    const totals = await getBasketTotals(saleId);

    if (detail !== '1') {
      return NextResponse.json({ baskets: totals });
    }

    const full = await Promise.all(totals.map((row) => getBasketDetail(row.basket_id)));
    const baskets = full.filter((b): b is BasketDetail => b !== null);

    // If the view found baskets and detail found none, something is wrong
    // and an empty array is a lie. Say so instead — an empty wall that
    // reports why beats an empty wall that shrugs.
    const dropped = totals.length - baskets.length;

    return NextResponse.json({
      baskets,
      ...(dropped > 0
        ? {
            warning: `${dropped} of ${totals.length} baskets could not be read in full.`,
          }
        : {}),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
