import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { ensureShortLink } from '@/lib/live/shortlink';
import { CUSTOMERS_TABLE } from '@/lib/live/schema';

export const dynamic = 'force-dynamic';

type Ctx = { params: { customerId: string } };

/**
 * The customer's portal link, shortened once and reused forever.
 *
 * Returns the stored short link if there is one. If not, builds the long
 * portal URL, asks dub to shorten it (idempotent on the customer id),
 * saves it back on the customer, and returns it. Every future call — this
 * live and every one after — returns the same short link.
 *
 * Falls back to the long URL if dub isn't configured or is unreachable, so
 * "Copy link" always yields a working link.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const db = liveDb();

    const cust = await db
      .from(CUSTOMERS_TABLE)
      .select('id, portal_token, portal_short_url')
      .eq('id', params.customerId)
      .maybeSingle();

    if (cust.error) throw new Error(cust.error.message);
    if (!cust.data) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const token = (cust.data as any).portal_token;
    const longUrl = `${portalBase()}/${token}`;

    // Already shortened — hand it back.
    const existing = (cust.data as any).portal_short_url;
    if (existing) {
      return NextResponse.json({ url: existing, short: true, longUrl });
    }

    // First time: shorten, store, return.
    const short = await ensureShortLink({ customerId: params.customerId, longUrl });

    if (short) {
      await db
        .from(CUSTOMERS_TABLE)
        .update({ portal_short_url: short })
        .eq('id', params.customerId);
      return NextResponse.json({ url: short, short: true, longUrl });
    }

    // dub unavailable — the long link works fine.
    return NextResponse.json({ url: longUrl, short: false, longUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function portalBase(): string {
  return (process.env.NEXT_PUBLIC_PORTAL_URL || 'https://order.erendirasboutique.com').replace(
    /\/+$/,
    ''
  );
}
