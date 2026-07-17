import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { getBasketDetail } from '@/lib/live/queries';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ basketId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { basketId } = await params;
    const basket = await getBasketDetail(basketId);
    if (!basket) {
      return NextResponse.json({ error: 'Basket not found' }, { status: 404 });
    }
    return NextResponse.json({ basket });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { basketId } = await params;
    const body = await req.json();

    const patch: Record<string, unknown> = {};
    for (const key of [
      'customer_id',
      'order_id',
      'shipping_cents',
      'discount_cents',
      'notes',
      'status',
    ]) {
      if (key in body) patch[key] = body[key];
    }

    // Keep the timestamps honest with the status.
    if (body.status === 'paid') patch.paid_at = new Date().toISOString();
    if (body.status === 'released') patch.released_at = new Date().toISOString();
    if (body.status === 'open') {
      patch.finalized_at = null;
      patch.released_at = null;
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { error } = await liveDb().from('baskets').update(patch).eq('id', basketId);
    if (error) throw new Error(error.message);

    return NextResponse.json({ basket: await getBasketDetail(basketId) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
