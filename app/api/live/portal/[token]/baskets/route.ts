import { NextResponse } from 'next/server';
import { getBasketsForPortalToken } from '@/lib/live/queries';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ token: string }> };

/**
 * Customer-facing. The portal_token is the credential, same as the rest
 * of the customer portal. Returns only what the customer should see —
 * no internal notes, no Stripe IDs.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    if (!token || token.length < 20) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
    }

    const baskets = await getBasketsForPortalToken(token);

    return NextResponse.json({
      baskets: baskets.map((b) => ({
        id: b.id,
        basket_number: b.basket_number,
        status: b.status,
        subtotal_cents: b.subtotal_cents,
        shipping_cents: b.shipping_cents,
        discount_cents: b.discount_cents,
        total_cents: b.total_cents,
        item_count: b.item_count,
        pay_url: b.status === 'finalized' ? b.stripe_payment_link_url : null,
        paid_at: b.paid_at,
        items: b.items.map((i) => ({
          id: i.id,
          description: i.description,
          description_es: i.description_es,
          photo_url: i.photo_url,
          quantity: i.quantity,
          unit_price_cents: i.unit_price_cents,
        })),
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
