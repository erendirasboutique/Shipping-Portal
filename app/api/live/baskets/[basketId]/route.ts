import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { getBasketDetail } from '@/lib/live/queries';
import { createOrderForBasket } from '@/lib/live/orders';
import { recordEvent } from '@/lib/live/timeline';
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
      'manual_total_cents',
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

    // .select() so we can see what actually changed. Without it, an update
    // that matches zero rows returns no error and looks like success —
    // which is exactly how "it doesn't save" produces no error message.
    const { data: updated, error } = await liveDb()
      .from('baskets')
      .update(patch)
      .eq('id', basketId)
      .select('*');

    if (error) throw new Error(error.message);

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        {
          error: `Nothing was updated. Basket ${basketId} did not match any row.`,
          debug: { basketId, fields: Object.keys(patch) },
        },
        { status: 404 }
      );
    }

    // Timeline: log what this PATCH actually changed. Best-effort — a
    // failed log never blocks the save (recordEvent swallows its own
    // errors), and these run after the row is already updated.
    if (patch.customer_id) {
      await recordEvent({
        basketId,
        kind: 'customer_matched',
        actor: by ?? undefined,
        detail: { customer_id: patch.customer_id },
      });
    }
    if (body.status === 'paid') {
      await recordEvent({
        basketId,
        kind: 'paid',
        actor: by ?? undefined,
        detail: { method: body.payment_method, note: body.payment_note ?? null },
      });
    }
    if (body.status === 'released') {
      await recordEvent({ basketId, kind: 'released', actor: by ?? undefined });
    }

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

    const detail = await getBasketDetail(basketId);

    // The update landed but the read-back came up empty — worth saying so
    // rather than handing the UI a null and letting it look like a no-op.
    if (!detail) {
      return NextResponse.json(
        { error: 'Saved, but the basket could not be read back.', saved: updated[0] },
        { status: 500 }
      );
    }

    // If customer_id was set and the joined customer is missing, the id
    // doesn't exist in shipping_customers — a merged or deleted row.
    if (patch.customer_id && !detail.customer) {
      return NextResponse.json({
        basket: detail,
        warning: 'Saved, but that customer record could not be found. It may have been merged.',
      });
    }

    return NextResponse.json({
      basket: detail,
      ...(warning ? { warning } : {}),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
