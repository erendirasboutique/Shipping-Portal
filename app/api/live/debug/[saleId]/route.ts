import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { getBasketDetail, getBasketTotals } from '@/lib/live/queries';

export const dynamic = 'force-dynamic';

type Ctx = { params: { saleId: string } };

/**
 * TEMPORARY. Delete once the basket wall is fixed.
 *
 * The baskets route returns {"baskets":[]} with no error while the data
 * plainly exists. That happens when getBasketTotals succeeds but every
 * getBasketDetail comes back null — and the .filter() that drops nulls
 * hides it. This runs each step separately and reports what it actually
 * got, including the errors the normal path swallows.
 *
 * Behind the staff login, same as every other /api/live route.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { saleId } = params;
  const db = liveDb();
  const out: Record<string, unknown> = {};

  // 1. Which key is this really? A service_role key bypasses RLS; an anon
  //    key doesn't. Views run as their owner and bypass RLS regardless,
  //    which would explain a populated view and an empty table. Reads the
  //    role claim only — the key itself never leaves the server.
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    const payload = JSON.parse(
      Buffer.from(key.split('.')[1] ?? '', 'base64').toString('utf8')
    );
    out.key_role = payload.role ?? 'unreadable';
  } catch {
    out.key_role = 'could not decode';
  }

  // 2. The view the wall reads.
  const totals = await db.from('basket_totals').select('*').eq('live_sale_id', saleId);
  out.basket_totals = { count: totals.data?.length ?? 0, error: totals.error?.message ?? null };

  // 3. The table underneath it.
  const baskets = await db.from('baskets').select('*').eq('live_sale_id', saleId);
  out.baskets_table = { count: baskets.data?.length ?? 0, error: baskets.error?.message ?? null };

  // 4. The exact call the route makes per basket — the suspect.
  const firstId = (totals.data as any[])?.[0]?.basket_id;
  if (firstId) {
    const one = await db.from('baskets').select('*').eq('id', firstId).maybeSingle();
    out.single_basket = {
      asked_for: firstId,
      got_row: Boolean(one.data),
      error: one.error?.message ?? null,
    };
  } else {
    out.single_basket = 'no basket_id came back from the view';
  }

  // 5. Claims.
  const items = await db.from('basket_items').select('id').limit(50);
  out.basket_items = { count: items.data?.length ?? 0, error: items.error?.message ?? null };

  // 6. Sales — this one demonstrably works, so it's the control.
  const sales = await db.from('live_sales').select('id').limit(5);
  out.live_sales = { count: sales.data?.length ?? 0, error: sales.error?.message ?? null };

  // 7. The real functions the route uses. Steps 2-4 above are hand-rolled
  //    copies of the same queries and they all pass — so if these fail,
  //    the bug is in my code, not the database.
  try {
    const totalsFn = await getBasketTotals(saleId);
    out.getBasketTotals = { count: totalsFn.length, first: totalsFn[0] ?? null };

    if (totalsFn[0]) {
      const detail = await getBasketDetail(totalsFn[0].basket_id);
      out.getBasketDetail = detail
        ? {
            returned: 'a basket',
            basket_number: detail.basket_number,
            item_count: detail.item_count,
            total_cents: detail.total_cents,
          }
        : 'NULL — this is the bug';
    }
  } catch (err: any) {
    // The live route swallows this into an empty array. Here it's the answer.
    out.function_error = { message: err?.message ?? String(err), stack: err?.stack ?? null };
  }

  return NextResponse.json(out);
}
