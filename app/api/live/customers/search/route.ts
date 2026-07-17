import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';

export const dynamic = 'force-dynamic';

/**
 * Typeahead for matching a basket to a customer.
 *
 * If your customers table uses different column names (first_name /
 * last_name instead of name, say), change SELECT_COLS and SEARCH_COLS
 * here — it's the only place this module assumes a shape.
 */
const CUSTOMERS_TABLE = 'customers';
const SELECT_COLS = 'id, name, email, phone, portal_token';
const SEARCH_COLS = ['name', 'email', 'phone'];

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get('q')?.trim();
    if (!q || q.length < 2) return NextResponse.json({ customers: [] });

    const filter = SEARCH_COLS.map((col) => `${col}.ilike.%${q}%`).join(',');

    const { data, error } = await liveDb()
      .from(CUSTOMERS_TABLE)
      .select(SELECT_COLS)
      .or(filter)
      .limit(8);

    if (error) throw new Error(error.message);
    return NextResponse.json({ customers: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
