'use client';

import { useCallback, useEffect, useState } from 'react';
import { centsToDisplay, formatSaleDate } from '@/lib/live/money';

type PortalItem = {
  id: string;
  description: string;
  description_es: string | null;
  quantity: number;
  unit_price_cents: number;
};

type PortalBasket = {
  id: string;
  basket_number: number;
  status: string;
  sale_date: string | null;
  sale_title: string | null;
  photo_url: string | null;
  tracking_number: string | null;
  carrier: string | null;
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  item_count: number;
  paid_at: string | null;
  due_at: string | null;
  payment_instructions: string | null;
  payment_instructions_es: string | null;
  pay_url: string | null;
  items: PortalItem[];
};

const copy = {
  en: {
    heading: 'Your basket',
    from: 'From the live on',
    forming: 'Still adding',
    ready: 'Ready to pay',
    paid: 'Paid — shipping Saturday',
    released: 'Released',
    shipped: 'Shipped',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    discount: 'Discount',
    total: 'Total',
    howToPay: 'How to pay',
    dueBy: 'Please pay by',
    payCard: 'Pay by card',
    noInstructions: 'We sent you a message with the payment options.',
    empty: 'Nothing here yet.',
    each: 'each',
    tracking: 'Tracking',
    track: 'Track your package',
  },
  es: {
    heading: 'Tu canasta',
    from: 'Del live del',
    forming: 'Todavía agregando',
    ready: 'Lista para pagar',
    paid: 'Pagada — se envía el sábado',
    released: 'Liberada',
    shipped: 'Enviada',
    subtotal: 'Subtotal',
    shipping: 'Envío',
    discount: 'Descuento',
    total: 'Total',
    howToPay: 'Cómo pagar',
    dueBy: 'Por favor paga antes del',
    payCard: 'Pagar con tarjeta',
    noInstructions: 'Te enviamos un mensaje con las opciones de pago.',
    empty: 'Nada por aquí todavía.',
    each: 'c/u',
    tracking: 'Rastreo',
    track: 'Rastrea tu paquete',
  },
} as const;

function trackUrl(num: string) {
  const base = process.env.NEXT_PUBLIC_TRACK_URL ?? 'https://track.erendirasboutique.com';
  return `${base.replace(/\/+$/, '')}/?tracking=${encodeURIComponent(num)}`;
}

export default function PortalBaskets({
  token,
  locale: forced,
}: {
  token: string;
  locale?: 'en' | 'es';
}) {
  const [locale, setLocale] = useState<'en' | 'es'>(forced ?? 'es');
  const [baskets, setBaskets] = useState<PortalBasket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (forced) return;
    const lang = navigator.language?.toLowerCase() ?? '';
    setLocale(lang.startsWith('en') ? 'en' : 'es');
  }, [forced]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/portal/${token}/baskets`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'We could not load your basket.');
        return;
      }
      setBaskets(json.baskets ?? []);
      setError(null);
    } catch {
      // Offline or a dropped connection. Keep whatever's on screen —
      // a stale total beats an error message they can't act on.
    }
  }, [token]);

  /**
   * Keep it current.
   *
   * The basket changes under them: you add an item, fix a price, finalize,
   * mark it paid, add tracking. A page fetched once and left open all
   * evening quietly lies — and then they message you asking why the total
   * is wrong.
   *
   * Polls every 20s while the tab is visible, stops when it isn't (nobody
   * needs a phone in a pocket hitting the API all night), and refetches the
   * moment they come back.
   */
  useEffect(() => {
    load();

    let timer: number | undefined;

    function start() {
      stop();
      timer = window.setInterval(load, 20000);
    }
    function stop() {
      if (timer) window.clearInterval(timer);
      timer = undefined;
    }
    function onVisible() {
      if (document.visibilityState === 'visible') {
        load();
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  const t = copy[locale];

  if (error) {
    return <p style={{ color: 'var(--alert)' }}>{error}</p>;
  }

  if (baskets === null) {
    return <p className="live__muted">…</p>;
  }

  if (baskets.length === 0) {
    return (
      <div className="live__empty">
        <p className="live__muted" style={{ margin: 0 }}>
          {t.empty}
        </p>
      </div>
    );
  }

  function statusLabel(status: string) {
    if (status === 'open') return t.forming;
    if (status === 'finalized') return t.ready;
    if (status === 'released') return t.released;
    if (status === 'shipped') return t.shipped;
    return t.paid;
  }

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      {baskets.map((b) => {
        const instructions =
          locale === 'es' && b.payment_instructions_es
            ? b.payment_instructions_es
            : b.payment_instructions;

        return (
          <section key={b.id} className="live__card ob">
            {/* Their actual basket, first. It's what they recognise —
                they picked these things out on a live an hour ago. */}
            {b.photo_url && (
              <img className="ob__hero" src={b.photo_url} alt="" />
            )}

            <div className="ob__head">
              <div>
                <h2 className="ob__title">
                  {t.heading} <span className="live__mono live__muted">#{b.basket_number}</span>
                </h2>
                {b.sale_date && (
                  <p className="ob__from">
                    {t.from} {b.sale_title || formatSaleDate(b.sale_date, locale)}
                  </p>
                )}
              </div>
              <span className={`live__pill live__pill--${b.status}`}>
                {statusLabel(b.status)}
              </span>
            </div>

            <ul className="ob__items">
              {b.items.map((i) => (
                <li key={i.id}>
                  <span>
                    {locale === 'es' && i.description_es ? i.description_es : i.description}
                    {i.quantity > 1 && (
                      <span className="live__muted live__mono">
                        {' '}
                        ×{i.quantity} · {centsToDisplay(i.unit_price_cents, locale)} {t.each}
                      </span>
                    )}
                  </span>
                  <span className="live__mono">
                    {centsToDisplay(i.unit_price_cents * i.quantity, locale)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="ob__totals">
              <Row label={t.subtotal} value={centsToDisplay(b.subtotal_cents, locale)} />
              {b.shipping_cents > 0 && (
                <Row label={t.shipping} value={centsToDisplay(b.shipping_cents, locale)} />
              )}
              {b.discount_cents > 0 && (
                <Row label={t.discount} value={`−${centsToDisplay(b.discount_cents, locale)}`} />
              )}
              <Row label={t.total} value={centsToDisplay(b.total_cents, locale)} strong />
            </div>

            {b.status === 'finalized' && (
              <div className="ob__pay">
                <p className="live__eyebrow">{t.howToPay}</p>
                <p className={instructions ? 'ob__inst' : 'ob__inst live__muted'}>
                  {instructions || t.noInstructions}
                </p>
                {b.due_at && (
                  <p className="ob__due">
                    {t.dueBy}{' '}
                    {new Date(b.due_at).toLocaleString(locale === 'es' ? 'es-US' : 'en-US', {
                      weekday: 'long',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                )}
                {b.pay_url && (
                  <a className="live__btn ob__card" href={b.pay_url}>
                    {t.payCard}
                  </a>
                )}
              </div>
            )}

            {b.tracking_number && (
              <div className="ob__track">
                <p className="live__eyebrow">{t.tracking}</p>
                <p className="ob__num live__mono">
                  {b.carrier ? `${b.carrier} · ` : ''}
                  {b.tracking_number}
                </p>
                <a
                  className="live__btn live__btn--ghost ob__trackBtn"
                  href={trackUrl(b.tracking_number)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.track}
                </a>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`ob__row${strong ? ' ob__row--total' : ''}`}>
      <span className={strong ? undefined : 'live__muted'}>{label}</span>
      <span className="live__mono">{value}</span>
    </div>
  );
}
