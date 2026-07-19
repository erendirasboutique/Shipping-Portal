/**
 * Basket timeline: an append-only record of what happened and when.
 *
 * Two kinds of entry:
 *   - system events (created, item_added, finalized, paid, ...) recorded by
 *     the routes as they happen, with structured detail
 *   - notes typed by staff, attributed to whoever is logged in
 *
 * Everything is timestamped at insert. Recording never throws into the
 * caller: a timeline write failing must not roll back the real action
 * (finalizing, paying). Best-effort by design.
 */

import { liveDb } from '@/lib/live/supabase';

export type BasketEventKind =
  | 'created'
  | 'item_added'
  | 'item_removed'
  | 'customer_matched'
  | 'finalized'
  | 'paid'
  | 'released'
  | 'label_printed'
  | 'linked_order'
  | 'note';

export type BasketEvent = {
  id: string;
  basket_id: string;
  kind: BasketEventKind;
  body: string | null;
  detail: Record<string, unknown> | null;
  actor: string | null;
  created_at: string;
};

/**
 * Record one event. Fire-and-forget from the caller's point of view — we
 * await it so it lands, but a failure is swallowed and logged, never thrown.
 */
export async function recordEvent(opts: {
  basketId: string;
  kind: BasketEventKind;
  body?: string;
  detail?: Record<string, unknown>;
  actor?: string;
}): Promise<void> {
  try {
    await liveDb().from('basket_events').insert({
      basket_id: opts.basketId,
      kind: opts.kind,
      body: opts.body ?? null,
      detail: opts.detail ?? null,
      actor: opts.actor ?? null,
    });
  } catch (err) {
    // A missing timeline entry is a small loss; a failed checkout because
    // the log write threw is not. Never let this break the caller.
    console.error('[timeline] could not record', opts.kind, err);
  }
}

export async function getTimeline(basketId: string): Promise<BasketEvent[]> {
  const { data, error } = await liveDb()
    .from('basket_events')
    .select('*')
    .eq('basket_id', basketId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as BasketEvent[];
}
