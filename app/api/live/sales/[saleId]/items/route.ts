import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { getCatalog } from '@/lib/live/queries';
import { normalizeCode } from '@/lib/live/money';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ saleId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { saleId } = await params;
    return NextResponse.json({ items: await getCatalog(saleId) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Accepts one item or an array of items, so the catalog screen can
 * paste in a whole rack at once.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { saleId } = await params;
    const body = await req.json();
    const incoming = Array.isArray(body.items) ? body.items : [body];

    const rows = incoming.map((raw: any, i: number) => {
      const code = normalizeCode(String(raw.code ?? ''));
      if (!code) throw new Error(`Row ${i + 1} is missing a tag code`);
      if (!raw.description) throw new Error(`Item ${code} is missing a description`);
      if (!Number.isInteger(raw.price_cents) || raw.price_cents < 0) {
        throw new Error(`Item ${code} has an invalid price`);
      }

      return {
        live_sale_id: saleId,
        code,
        description: String(raw.description),
        description_es: raw.description_es ?? null,
        price_cents: raw.price_cents,
        quantity: Number.isInteger(raw.quantity) ? raw.quantity : 1,
        photo_url: raw.photo_url ?? null,
        sort_order: Number.isInteger(raw.sort_order) ? raw.sort_order : i,
      };
    });

    const { data, error } = await liveDb().from('live_items').insert(rows).select('*');

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'That tag code is already used in this sale.' },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ items: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
