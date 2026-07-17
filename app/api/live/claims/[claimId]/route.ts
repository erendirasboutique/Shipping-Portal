import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';

export const dynamic = 'force-dynamic';

type Ctx = { params: { claimId: string } };

/**
 * Undo. Soft-voids rather than hard-deletes, so a misclick during a
 * chaotic live is still traceable on Thursday when someone disputes
 * their total.
 */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { claimId } = params;
    const db = liveDb();

    const by = new URL(req.url).searchParams.get('by');

    const { data, error } = await db
      .from('basket_items')
      .update({ voided_at: new Date().toISOString(), voided_by: by || null })
      .eq('id', claimId)
      .is('voided_at', null)
      .select('basket_id')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json(
        { error: 'That claim was already undone.' },
        { status: 404 }
      );
    }

    const totals = await db
      .from('basket_totals')
      .select('*')
      .eq('basket_id', data.basket_id)
      .maybeSingle();

    return NextResponse.json({ ok: true, basket: totals.data ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Change quantity on a claim without leaving the claims screen. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { claimId } = params;
    const body = await req.json();

    if (!Number.isInteger(body.quantity) || body.quantity < 1) {
      return NextResponse.json({ error: 'Quantity must be 1 or more.' }, { status: 400 });
    }

    const { data, error } = await liveDb()
      .from('basket_items')
      .update({ quantity: body.quantity })
      .eq('id', claimId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ claim: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
