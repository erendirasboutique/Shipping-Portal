import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { normalizeCode } from '@/lib/live/money';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ itemId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { itemId } = await params;
    const body = await req.json();

    const patch: Record<string, unknown> = {};
    if ('code' in body) patch.code = normalizeCode(String(body.code));
    for (const key of [
      'description',
      'description_es',
      'price_cents',
      'quantity',
      'photo_url',
      'sort_order',
    ]) {
      if (key in body) patch[key] = body[key];
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await liveDb()
      .from('live_items')
      .update(patch)
      .eq('id', itemId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ item: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { itemId } = await params;
    const db = liveDb();

    // Claimed items stay put — deleting one would quietly change a total
    // a customer may already have seen.
    const claimed = await db
      .from('basket_items')
      .select('id', { count: 'exact', head: true })
      .eq('live_item_id', itemId)
      .is('voided_at', null);

    if ((claimed.count ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            'This item is already in a basket. Undo the claim first, or set its quantity to 0 to take it off the rack.',
        },
        { status: 409 }
      );
    }

    const { error } = await db.from('live_items').delete().eq('id', itemId);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
