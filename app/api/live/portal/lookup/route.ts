import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { CUSTOMERS_TABLE } from '@/lib/live/schema';

export const dynamic = 'force-dynamic';

/**
 * Public basket lookup: "what basket number am I?"
 *
 * PRIVACY — read before changing anything here.
 *
 * This endpoint is public, so anyone can query it. That means it returns
 * the bare minimum: a basket number, a first name, a last initial. No
 * totals, no items, no email, no phone, and above all no portal_token —
 * the token is the credential for someone's order, and handing it out
 * from a name search would let anyone open anyone's basket.
 *
 * That's roughly what's already public anyway: during the live, customers
 * watch each other claim things by name in the comments.
 *
 * Scoped to the most recent live only. Someone's basket number from three
 * weeks ago isn't a lookup, it's a history.
 */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get('q')?.trim();

    // Three characters minimum. Two would let someone walk the alphabet
    // and enumerate the customer list.
    if (!q || q.length < 3) return NextResponse.json({ baskets: [] });

    const db = liveDb();

    const sale = await db
      .from('live_sales')
      .select('id')
      .order('sale_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sale.error || !sale.data) return NextResponse.json({ baskets: [] });

    const safe = q.replace(/[,()%]/g, ' ');

    const customers = await db
      .from(CUSTOMERS_TABLE)
      .select('id, name')
      .ilike('name', `%${safe}%`)
      .eq('archived', false)
      .is('merged_into', null)
      .limit(25);

    if (customers.error || !customers.data?.length) {
      return NextResponse.json({ baskets: [] });
    }

    const byId = new Map<string, string | null>(
      (customers.data as any[]).map((c) => [c.id as string, c.name as string | null])
    );

    const baskets = await db
      .from('baskets')
      .select('basket_number, customer_id, status')
      .eq('live_sale_id', sale.data.id)
      .in('customer_id', Array.from(byId.keys()))
      .not('status', 'in', '("void","released")')
      .order('basket_number', { ascending: true })
      .limit(10);

    if (baskets.error) throw new Error(baskets.error.message);

    return NextResponse.json({
      baskets: (baskets.data ?? []).map((b: any) => ({
        basket_number: b.basket_number,
        status: b.status,
        name: shorten(byId.get(b.customer_id) ?? null),
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** "Maria Gonzalez" -> "Maria G." — enough to recognise yourself, not enough to harvest. */
function shorten(name: string | null): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
