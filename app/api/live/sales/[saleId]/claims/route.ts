import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { ensureBasket, getRecentClaims } from '@/lib/live/queries';
import { normalizeCode } from '@/lib/live/money';

export const dynamic = 'force-dynamic';

type Ctx = { params: { saleId: string } };

/** Recent claims, for the undo rail. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { saleId } = params;
    return NextResponse.json({ claims: await getRecentClaims(saleId) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * The two-second path. Body: { basket_number, code, quantity? }
 *
 * Speed matters more than ceremony here, so this does the minimum:
 * find the item, find-or-create the basket, snapshot the price, insert.
 * Overselling is allowed but reported back so the screen can warn.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { saleId } = params;
    const body = await req.json();

    const basketNumber = Number(body.basket_number);
    if (!Number.isInteger(basketNumber) || basketNumber < 1) {
      return NextResponse.json(
        { error: 'Enter a basket number.' },
        { status: 400 }
      );
    }

    const code = normalizeCode(String(body.code ?? ''));
    if (!code) {
      return NextResponse.json({ error: 'Enter a tag code.' }, { status: 400 });
    }

    const quantity = Number.isInteger(body.quantity) && body.quantity > 0 ? body.quantity : 1;
    const db = liveDb();

    const item = await db
      .from('live_items')
      .select('*')
      .eq('live_sale_id', saleId)
      .ilike('code', code)
      .maybeSingle();

    if (item.error) throw new Error(item.error.message);
    if (!item.data) {
      return NextResponse.json(
        { error: `No item tagged ${code} in this sale.` },
        { status: 404 }
      );
    }

    const basket = await ensureBasket(saleId, basketNumber);

    if (basket.status !== 'open') {
      return NextResponse.json(
        {
          error: `Basket ${basketNumber} is ${basket.status}. Reopen it before adding items.`,
        },
        { status: 409 }
      );
    }

    const claim = await db
      .from('basket_items')
      .insert({
        basket_id: basket.id,
        live_item_id: item.data.id,
        description: item.data.description,
        description_es: item.data.description_es,
        photo_url: item.data.photo_url,
        quantity,
        unit_price_cents: item.data.price_cents,
      })
      .select('*')
      .single();

    if (claim.error) throw new Error(claim.error.message);

    const [totals, stock] = await Promise.all([
      db.from('basket_totals').select('*').eq('basket_id', basket.id).maybeSingle(),
      db.from('live_item_stock').select('*').eq('live_item_id', item.data.id).maybeSingle(),
    ]);

    return NextResponse.json(
      {
        claim: claim.data,
        basket: { ...basket, ...(totals.data ?? {}) },
        item: item.data,
        stock: stock.data ?? null,
        oversold: (stock.data?.quantity_remaining ?? 0) < 0,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
