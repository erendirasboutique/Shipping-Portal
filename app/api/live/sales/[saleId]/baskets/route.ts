import { NextResponse } from 'next/server';
import { getBasketTotals } from '@/lib/live/queries';

export const dynamic = 'force-dynamic';

type Ctx = { params: { saleId: string } };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { saleId } = params;
    return NextResponse.json({ baskets: await getBasketTotals(saleId) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
