import { NextResponse } from 'next/server';
import { liveDb } from '@/lib/live/supabase';
import { getBasketsForPortalToken } from '@/lib/live/queries';
import { CUSTOMERS_TABLE, formatOrderNumber } from '@/lib/live/schema';

export const dynamic = 'force-dynamic';

/**
 * Baskets for one email address — for the BILLING portal to call.
 *
 * my.erendirasboutique.com is a different app on a different Supabase
 * project, so it can't read these tables. This is the door.
 *
 * AUTH: a shared secret in a header, not a session. The billing portal
 * calls this SERVER-SIDE, after it has already authenticated the customer
 * and knows their email. The secret never reaches a browser.
 *
 * That means this endpoint trusts whoever holds the secret to have done
 * the authentication. Do NOT call it from client-side code in the billing
 * portal — that would put the secret in the page and let anyone read any
 * customer's baskets by changing the email.
 */
export async function GET(req: Request) {
  try {
    const secret = process.env.LIVE_API_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'LIVE_API_SECRET is not set on the shipping portal.' },
        { status: 500 }
      );
    }

    const provided = req.headers.get('x-live-secret');
    if (!provided || provided !== secret) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
    }

    const email = new URL(req.url).searchParams.get('email')?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'An email is required.' }, { status: 400 });
    }

    const db = liveDb();

    // ilike, not eq — emails get stored with whatever case the customer
    // typed, and "Maria@…" and "maria@…" are the same person.
    const customer = await db
      .from(CUSTOMERS_TABLE)
      .select('id, portal_token')
      .ilike('email', email)
      .not('archived', 'is', true)
      .is('merged_into', null)
      .limit(1)
      .maybeSingle();

    if (customer.error) throw new Error(customer.error.message);

    const token = (customer.data as any)?.portal_token;
    if (!token) return NextResponse.json({ baskets: [] });

    // Reuse the same reader the customer's own page uses — one code path,
    // so the two portals can't drift apart.
    const baskets = await getBasketsForPortalToken(token);

    return NextResponse.json({
      // Handy if the billing portal wants to deep-link to the full page.
      portal_token: token,
      baskets: baskets.map((b) => ({
        id: b.id,
        basket_number: b.basket_number,
        status: b.status,
        photo_url: b.photo_url,
        subtotal_cents: b.subtotal_cents,
        shipping_cents: b.shipping_cents,
        discount_cents: b.discount_cents,
        total_cents: b.total_cents,
        item_count: b.item_count,
        paid_at: b.paid_at,
        order_number: formatOrderNumber(b.order?.order_number),
        tracking_number: b.order?.tracking_number ?? b.tracking_number,
        tracking_url: b.order?.tracking_url ?? null,
        carrier: b.order?.carrier ?? b.carrier,
        pay_url: b.status === 'finalized' ? b.stripe_payment_link_url : null,
        items: b.items.map((i) => ({
          id: i.id,
          description: i.description,
          description_es: i.description_es,
          quantity: i.quantity,
          unit_price_cents: i.unit_price_cents,
        })),
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
