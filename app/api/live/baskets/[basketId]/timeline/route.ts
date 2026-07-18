import { NextResponse } from 'next/server';
import { getTimeline, recordEvent } from '@/lib/live/timeline';

export const dynamic = 'force-dynamic';

type Ctx = { params: { basketId: string } };

/** The basket's timeline, oldest first. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    return NextResponse.json({ events: await getTimeline(params.basketId) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, events: [] }, { status: 500 });
  }
}

/**
 * Add a staff note to the timeline. Body: { body, by }.
 * `by` is the logged-in operator's name, so the note reads as "— Dylan".
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    const by = typeof body.by === 'string' && body.by.trim() ? body.by.trim() : null;

    if (!text) {
      return NextResponse.json({ error: 'Write something first.' }, { status: 400 });
    }

    await recordEvent({
      basketId: params.basketId,
      kind: 'note',
      body: text,
      actor: by ?? undefined,
    });

    return NextResponse.json({ events: await getTimeline(params.basketId) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
