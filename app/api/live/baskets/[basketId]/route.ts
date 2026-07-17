import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { getBasketDetail } from '@/lib/live/queries';
import { createOrderForBasket } from '@/lib/live/orders';
import { PAYMENT_METHODS } from '@/lib/live/schema';

export const dynamic = 'force-dynamic';

type Ctx = { params: { basketId: string } };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { basketId } = params;
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
    const { basketId } = params;
    const body = await req.json();

    const patch: Record<string, unknown> = {};
    for (const key of [
      'customer_id',
      'order_id',
      'shipping_cents',
      'discount_cents',
      'notes',
      'status',
      'payment_method',
      'payment_note',
      'stripe_payment_link_url',
      'photo_url',
      'tracking_number',
      'carrier',
    ]) {
      if (key in body) patch[key] = body[key];
    }

    const by = typeof body.by === 'string' && body.by.trim() ? body.by.trim() : null;

    // Marking paid requires knowing how. The database enforces this too,
    // but a clear message beats a constraint violation.
    if (body.status === 'paid') {
      const method = body.payment_method;
      const valid = PAYMENT_METHODS.some((m) => m.value === method);
      if (!valid) {
        return NextResponse.json(
          { error: 'Pick how they paid before marking this basket paid.' },
          { status: 400 }
        );
      }
      patch.paid_at = new Date().toISOString();
      patch.paid_by = by;
    }

    if (body.status === 'released') {
      patch.released_at = new Date().toISOString();
      patch.released_by = by;
    }

    // Reopening clears the payment record — otherwise a basket can sit in
    // 'open' still claiming it was paid by Zelle.
    if (body.status === 'open') {
      patch.finalized_at = null;
      patch.released_at = null;
      patch.paid_at = null;
      patch.paid_by = null;
      patch.payment_method = null;
      patch.payment_note = null;
      patch.finalized_by = null;
      patch.released_by = null;
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { error } = await liveDb().from('baskets').update(patch).eq('id', basketId);
    if (error) throw new Error(error.message);

    // A paid basket becomes a draft order so Saturday's labels are
    // already queued. Idempotent — clicking twice won't make two orders.
    let warning: string | null = null;
    if (body.status === 'paid') {
      try {
        await createOrderForBasket(basketId);
      } catch (err: any) {
        warning = `Marked paid, but the order didn't get created: ${err.message}`;
      }
    }

    return NextResponse.json({
      basket: await getBasketDetail(basketId),
      ...(warning ? { warning } : {}),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
