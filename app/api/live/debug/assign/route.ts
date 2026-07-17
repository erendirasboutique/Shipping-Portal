import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { CUSTOMERS_TABLE } from '@/lib/live/schema';

export const dynamic = 'force-dynamic';

/**
 * TEMPORARY. Delete once assignment works.
 *
 * Does the customer assignment server-side, with no UI, no React, no
 * optimistic state — and reports every step. If the write works here and
 * not in the drawer, the bug is in the browser. If it fails here, it's the
 * database and the error will say why.
 *
 * Usage (while logged in):
 *   /api/live/debug/assign?basket=<basket uuid>&customer=<customer uuid>
 *
 * Yes, a GET that writes. It's a debug tool behind the staff login and
 * it's getting deleted.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const basketId = url.searchParams.get('basket');
  const customerId = url.searchParams.get('customer');

  // Bump this when you re-upload, so we can both tell whether the deploy
  // actually took. Guessing about that has cost us hours.
  const out: Record<string, unknown> = { build: 'assign-debug-1' };

  if (!basketId) {
    return NextResponse.json({
      ...out,
      how: 'Add ?basket=<basket uuid>&customer=<customer uuid>',
      hint: 'Get both uuids from /api/live/debug/<saleId> and /api/live/customers/search?q=',
    });
  }

  const db = liveDb();

  const before = await db
    .from('baskets')
    .select('id, basket_number, customer_id, status, updated_at')
    .eq('id', basketId)
    .maybeSingle();

  out.before = { row: before.data ?? null, error: before.error?.message ?? null };

  if (customerId) {
    const cust = await db
      .from(CUSTOMERS_TABLE)
      .select('id, name, archived, merged_into')
      .eq('id', customerId)
      .maybeSingle();

    out.customer_exists = { row: cust.data ?? null, error: cust.error?.message ?? null };

    // The exact write the PATCH route performs.
    const upd = await db
      .from('baskets')
      .update({ customer_id: customerId })
      .eq('id', basketId)
      .select('id, customer_id, updated_at');

    out.update = {
      rows_changed: upd.data?.length ?? 0,
      returned: upd.data ?? null,
      error: upd.error?.message ?? null,
      error_code: (upd.error as any)?.code ?? null,
      error_details: (upd.error as any)?.details ?? null,
      error_hint: (upd.error as any)?.hint ?? null,
    };

    // Read it back on a fresh query — did it actually persist?
    const after = await db
      .from('baskets')
      .select('id, basket_number, customer_id, updated_at')
      .eq('id', basketId)
      .maybeSingle();

    out.after = { row: after.data ?? null, error: after.error?.message ?? null };
    out.verdict =
      (after.data as any)?.customer_id === customerId
        ? 'WRITE WORKS — the database saved it. The bug is in the browser.'
        : 'WRITE FAILS — the database did not keep it. See update.error above.';
  }

  return NextResponse.json(out);
}
