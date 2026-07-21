import { liveDb } from '@/lib/live/supabase';
import { buildItemLabel } from '@/lib/live/label';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: { itemId: string } };

/**
 * A 2.25 x 1.25" thermal label for a catalog item — the item CODE big and
 * centered (e.g. "A1"), with the description underneath. Same label engine
 * and Recoleta font as the pickup label; here the "tagline" slot carries
 * the code so it prints large.
 *
 * Print it and stick it on the item during the live so the code is easy to
 * read on camera.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { data, error } = await liveDb()
    .from('live_items')
    .select('code, description')
    .eq('id', params.itemId)
    .maybeSingle();

  if (error || !data) {
    return new Response('Item not found', { status: 404 });
  }

  const code = String((data as any).code || '').toUpperCase();
  const description = String((data as any).description || '');

  const pdf = await buildItemLabel({ code, description });

  return new Response(pdf as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="item-${code}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
