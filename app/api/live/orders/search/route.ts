import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { ORDERS_TABLE } from '@/lib/live/schema';

export const dynamic = 'force-dynamic';

/**
 * Search shipping orders to attach a basket to an existing one.
 *
 * Matches on EB number (digits) or recipient name. Staff route — behind the
 * live admin login, no shared secret.
 */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
    if (q.length < 1) return NextResponse.json({ orders: [] });

    const db = liveDb();
    const digits = q.replace(/\D/g, '');

    // Name match always; if the query has digits, also match the order
    // number exactly.
    let query = db
      .from(ORDERS_TABLE)
      .select('id, order_number, to_name, to_city, to_state, status, tracking_number, carrier')
      .order('order_number', { ascending: false })
      .limit(8);

    if (digits) {
      query = query.or(`to_name.ilike.%${q}%,order_number.eq.${digits}`);
    } else {
      query = query.ilike('to_name', `%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ orders: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, orders: [] }, { status: 500 });
  }
}
