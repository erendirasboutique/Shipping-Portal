import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { listSales } from '@/lib/live/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ sales: await listSales() });
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
