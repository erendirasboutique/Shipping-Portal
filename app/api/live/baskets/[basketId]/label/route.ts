import { getBasketDetail } from '@/lib/live/queries';
import { formatOrderNumber } from '@/lib/live/schema';
import { buildPickupLabel } from '@/lib/live/label';
import { recordEvent } from '@/lib/live/timeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: { basketId: string } };

/**
 * A 2.25 x 1.25" thermal pickup label as a PDF, sized for a Rollo.
 *
 * Why a PDF and not a direct print: browsers can't talk to a printer, and
 * Rollo has no public print API — their remote printing goes through the
 * Rollo Ship app. So the honest path is a correctly-sized PDF the staff
 * member prints the same way they print a shipping label. On a phone the
 * share sheet offers the Rollo; on a paired Mac/PC it's the print dialog.
 *
 * ?kind=pickup is the default. The tagline is a query param so the same
 * route can print "HOLD" or "MERGE" tags without new code.
 */
export async function GET(req: Request, { params }: Ctx) {
  const basket = await getBasketDetail(params.basketId);

  if (!basket) {
    return new Response('Basket not found', { status: 404 });
  }

  const url = new URL(req.url);
  const tagline = url.searchParams.get('tag') || 'Pickup';

  const name = basket.customer?.name || `Canasta ${basket.basket_number}`;
  const orderNo = formatOrderNumber(basket.order?.order_number);
  // Spanish sub-line: "Canasta #12" plus the EB number if there is one.
  const sub = [`Canasta #${basket.basket_number}`, orderNo].filter(Boolean).join(' · ');

  const pdf = await buildPickupLabel({ tagline, name, sub });

  // Log the print so the timeline shows a label went out.
  await recordEvent({
    basketId: basket.id,
    kind: 'label_printed',
    detail: { tag: tagline },
  });

  return new Response(pdf as any, {
    headers: {
      'Content-Type': 'application/pdf',
      // inline, so a phone opens it in the viewer where the share/print
      // action lives, rather than dumping a file into Downloads.
      'Content-Disposition': `inline; filename="pickup-${basket.basket_number}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
