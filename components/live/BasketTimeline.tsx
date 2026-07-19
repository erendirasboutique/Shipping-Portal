'use client';

import { useCallback, useEffect, useState } from 'react';
import { getOperator } from '@/lib/live/operator';
import { useLocale } from '@/lib/live/i18n';
import type { BasketEvent } from '@/lib/live/timeline';

/**
 * The basket's history: created, items in and out, matched, finalized,
 * paid, printed — plus notes staff type, attributed to whoever's logged
 * in. Everything timestamped.
 *
 * Loads when the drawer opens (basketId changes). Kept out of the main
 * drawer render so the wall doesn't pay for it until a basket is opened.
 */

const KIND_LABEL: Record<string, { en: string; es: string }> = {
  created: { en: 'Basket created', es: 'Canasta creada' },
  item_added: { en: 'Item added', es: 'Artículo agregado' },
  item_removed: { en: 'Item removed', es: 'Artículo quitado' },
  customer_matched: { en: 'Customer matched', es: 'Cliente asignado' },
  finalized: { en: 'Total finalized', es: 'Total finalizado' },
  paid: { en: 'Marked paid', es: 'Marcada como pagada' },
  released: { en: 'Released', es: 'Liberada' },
  label_printed: { en: 'Pickup label printed', es: 'Etiqueta impresa' },
  linked_order: { en: 'Linked to order', es: 'Vinculada a pedido' },
  note: { en: 'Note', es: 'Nota' },
};

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export default function BasketTimeline({ basketId }: { basketId: string }) {
  const { locale, t } = useLocale();
  const [events, setEvents] = useState<BasketEvent[] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/baskets/${basketId}/timeline`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setEvents(json.events ?? []);
      else setEvents([]);
    } catch {
      setEvents([]);
    }
  }, [basketId]);

  useEffect(() => {
    setEvents(null);
    load();
  }, [load]);

  async function addNote() {
    const body = note.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/live/baskets/${basketId}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, by: getOperator() }),
      });
      const json = await res.json();
      if (res.ok) {
        setEvents(json.events ?? []);
        setNote('');
      }
    } finally {
      setBusy(false);
    }
  }

  function describe(e: BasketEvent): string {
    const label = KIND_LABEL[e.kind]?.[locale] ?? e.kind;
    const d = e.detail ?? {};
    if (e.kind === 'item_added' || e.kind === 'item_removed') {
      const qty = (d.quantity as number) ?? 1;
      const desc = (d.description as string) ?? '';
      return `${label}: ${desc}${qty > 1 ? ` ×${qty}` : ''}`;
    }
    if (e.kind === 'finalized' && typeof d.total_cents === 'number') {
      return `${label} · ${money(d.total_cents)}`;
    }
    if (e.kind === 'paid' && d.method) {
      return `${label} · ${d.method}`;
    }
    return label;
  }

  function when(iso: string): string {
    return new Date(iso).toLocaleString(locale === 'es' ? 'es-US' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return (
    <section className="drawer__sec">
      <p className="live__label">{t.timeline}</p>

      {events === null ? (
        <p className="live__muted drawer__hint">{t.timelineLoading}</p>
      ) : events.length === 0 ? (
        <p className="live__muted drawer__hint">{t.timelineEmpty}</p>
      ) : (
        <ol className="tl">
          {events.map((e) => (
            <li key={e.id} className={`tl__row tl__row--${e.kind}`}>
              <span className="tl__dot" aria-hidden="true" />
              <div className="tl__body">
                <p className="tl__what">{describe(e)}</p>
                {e.body && <p className="tl__note">{e.body}</p>}
                <p className="tl__meta">
                  {when(e.created_at)}
                  {e.actor && (
                    <>
                      {' · '}
                      {t.by} <b>{e.actor}</b>
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="tl__add">
        <textarea
          className="live__textarea"
          rows={2}
          placeholder={t.timelineNotePlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="live__btn live__btn--ghost" disabled={busy || !note.trim()} onClick={addNote}>
          {t.timelineAddNote}
        </button>
      </div>
    </section>
  );
}
