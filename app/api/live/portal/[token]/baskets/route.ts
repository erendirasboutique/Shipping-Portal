import { NextResponse } from 'next/server';
import { getBasketsForPortalToken } from '@/lib/live/queries';
import { liveDb } from '@/lib/live/supabase';
import { isUuid } from '@/lib/live/schema';

export const dynamic = 'force-dynamic';

type Ctx = { params: { token: string } };

/**
 * Customer-facing. The portal_token is the credential, same as the rest
 * of the customer portal. Returns only what the customer should see — no
 * internal notes, no payment_method, no Stripe IDs.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { token } = params;
    // portal_token is a uuid column, so anything else is a bad link.
    if (!isUuid(token)) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
    }

    const baskets = await getBasketsForPortalToken(token);
    if (!baskets.length) return NextResponse.json({ baskets: [] });

    // How-to-pay text lives on the sale, so it can change any week.
    // Plain filter rather than [...new Set()] — this project targets ES5,
    // where spreading a Set needs downlevelIteration. Ten baskets max, so
    // the O(n²) is free.
    const saleIds = baskets
      .map((b) => b.live_sale_id)
      .filter((id, i, all) => all.indexOf(id) === i);
    const sales = await liveDb()
      .from('live_sales')
      .select('id, sale_date, title, payment_due_at, payment_instructions, payment_instructions_es')
      .in('id', saleIds);

    const saleById = new Map<string, any>((sales.data ?? []).map((s: any) => [s.id, s]));

    return NextResponse.json({
      baskets: baskets.map((b) => {
        const sale = saleById.get(b.live_sale_id);
        return {
          id: b.id,
          basket_number: b.basket_number,
          status: b.status,
          // Which live this came from — customers shop several weeks and
          // otherwise can't tell two baskets apart.
          sale_date: sale?.sale_date ?? null,
          sale_title: sale?.title ?? null,
          photo_url: b.photo_url,
          tracking_number: b.tracking_number,
          carrier: b.carrier,
          subtotal_cents: b.subtotal_cents,
          shipping_cents: b.shipping_cents,
          discount_cents: b.discount_cents,
          total_cents: b.total_cents,
          item_count: b.item_count,
          paid_at: b.paid_at,
          due_at: sale?.payment_due_at ?? null,
          payment_instructions: sale?.payment_instructions ?? null,
          payment_instructions_es: sale?.payment_instructions_es ?? null,
          // Only present if staff made a card link for this basket.
          pay_url: b.status === 'finalized' ? b.stripe_payment_link_url : null,
          items: b.items.map((i) => ({
            id: i.id,
            description: i.description,
            description_es: i.description_es,
            photo_url: i.photo_url,
            quantity: i.quantity,
            unit_price_cents: i.unit_price_cents,
          })),
        };
      }),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
