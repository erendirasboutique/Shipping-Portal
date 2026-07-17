import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { getBasketTotals, listSales } from '@/lib/live/queries';

export const dynamic = 'force-dynamic';

/**
 * ?summary=1 adds basket counts and gross per sale — what the index page
 * shows. Without it you get the bare sale rows.
 */
export async function GET(req: Request) {
  try {
    const sales = await listSales();
    const wantSummary = new URL(req.url).searchParams.get('summary') === '1';

    if (!wantSummary) return NextResponse.json({ sales });

    const summaries = await Promise.all(
      sales.slice(0, 12).map(async (sale) => {
        const baskets = await getBasketTotals(sale.id);
        return {
          sale,
          basketCount: baskets.length,
          paidCount: baskets.filter((b) => b.status === 'paid' || b.status === 'shipped').length,
          gross: baskets
            .filter((b) => b.status !== 'released' && b.status !== 'void')
            .reduce((sum, b) => sum + b.total_cents, 0),
        };
      })
    );

    return NextResponse.json({ sales, summaries });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { data, error } = await liveDb()
      .from('live_sales')
      .insert({
        sale_date: body.sale_date ?? new Date().toISOString().slice(0, 10),
        title: body.title ?? null,
        payment_due_at: body.payment_due_at ?? null,
        payment_instructions: body.payment_instructions ?? null,
        payment_instructions_es: body.payment_instructions_es ?? null,
        default_shipping_cents: body.default_shipping_cents ?? 0,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ sale: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
