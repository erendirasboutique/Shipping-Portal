import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import {
  CUSTOMERS_TABLE,
  CUSTOMER_COLS,
  CUSTOMER_SEARCH_COLS,
  CUSTOMER_SEARCH_SELECT,
} from '@/lib/live/schema';

export const dynamic = 'force-dynamic';

/**
 * Typeahead for matching a basket to a customer.
 *
 * Archived customers and rows that were merged into a duplicate are
 * excluded — matching a basket to a merged-away customer would send the
 * total to a portal token nobody checks.
 */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get('q')?.trim();
    if (!q || q.length < 2) return NextResponse.json({ customers: [] });

    // Escape PostgREST's or() delimiters so a name with a comma or a
    // parenthesis doesn't break the filter.
    const safe = q.replace(/[,()]/g, ' ');
    const filter = CUSTOMER_SEARCH_COLS.map((col) => `${col}.ilike.%${safe}%`).join(',');

    const { data, error } = await liveDb()
      .from(CUSTOMERS_TABLE)
      .select(CUSTOMER_SEARCH_SELECT)
      .or(filter)
      .eq(CUSTOMER_COLS.archived, false)
      .is(CUSTOMER_COLS.mergedInto, null)
      .limit(8);

    if (error) throw new Error(error.message);
    return NextResponse.json({ customers: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
