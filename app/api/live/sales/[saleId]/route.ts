import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { getSale } from '@/lib/live/queries';

export const dynamic = 'force-dynamic';

type Ctx = { params: { saleId: string } };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { saleId } = params;
    const sale = await getSale(saleId);
    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }
    return NextResponse.json({ sale });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { saleId } = params;
    const body = await req.json();

    const patch: Record<string, unknown> = {};
    for (const key of [
      'title',
      'sale_date',
      'status',
      'payment_due_at',
      'payment_instructions',
      'payment_instructions_es',
      'default_shipping_cents',
      'payment_instructions',
      'payment_instructions_es',
    ]) {
      if (key in body) patch[key] = body[key];
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await liveDb()
      .from('live_sales')
      .update(patch)
      .eq('id', saleId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ sale: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { saleId } = params;
    const { error } = await liveDb().from('live_sales').delete().eq('id', saleId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
