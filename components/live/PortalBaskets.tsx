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
  order_number: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
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
    basket: 'Basket',
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
    payCard: 'Pay by card or installments',
    payOpening: 'Opening secure checkout…',
    noInstructions: 'We sent you a message with the payment options.',
    empty: 'Nothing here yet.',
    each: 'each',
    tracking: 'Tracking',
    track: 'Track your package',
  },
  es: {
    heading: 'Tu canasta',
    basket: 'Canasta',
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
    payCard: 'Pagar con tarjeta o a plazos',
    payOpening: 'Abriendo pago seguro…',
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

  // Which basket is currently opening a checkout, so its button can show a
  // spinner and not be tapped twice.
  const [payingId, setPayingId] = useState<string | null>(null);

  async function startCheckout(basketId: string) {
    setPayingId(basketId);
    try {
      const res = await fetch(`/api/live/portal/${token}/baskets/${basketId}/pay`, {
        method: 'POST',
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok && json.url) {
        // Straight to Stripe's hosted page — card + BNPL live there.
        window.location.href = json.url;
        return;
      }
      setPayingId(null);
    } catch {
      setPayingId(null);
    }
  }

  // Spanish is the default and stays the default. The customers are
  // Spanish-speaking; browser language is a weak signal (a borrowed phone,
  // an English-set device in Spanish-speaking hands) and shouldn't flip
  // the whole page. Only an explicit ?lang=en switches it.
  useEffect(() => {
    if (forced) return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('lang') === 'en') setLocale('en');
    } catch {
      // stays es
    }
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
    <div className="ob2">
      {baskets.map((b) => {
        const instructions =
          locale === 'es' && b.payment_instructions_es
            ? b.payment_instructions_es
            : b.payment_instructions;

        const paid = b.status === 'paid' || b.status === 'shipped';

        return (
          <article key={b.id} className="ob2__ticket">
            {/* Hero: their own basket photo, total set over a dark scrim.
                The signature of the page — the thing they recognise from
                the live, with what they owe laid right on top of it. */}
            <div className="ob2__hero">
              {b.photo_url ? (
                <img className="ob2__heroImg" src={b.photo_url} alt="" />
              ) : (
                <div className="ob2__heroImg ob2__heroImg--none" />
              )}
              <div className="ob2__heroVeil" />
              <div className="ob2__heroText">
                <span className="ob2__basketNo">
                  {t.basket} #{b.basket_number}
                </span>
                <span className="ob2__heroTotal">{centsToDisplay(b.total_cents, locale)}</span>
                {b.sale_date && (
                  <span className="ob2__heroFrom">
                    {t.from} {b.sale_title || formatSaleDate(b.sale_date, locale)}
                  </span>
                )}
              </div>
              <span className={`ob2__stamp ob2__stamp--${b.status}`}>{statusLabel(b.status)}</span>
            </div>

            {/* Receipt tape: the itemization, as a boutique receipt. */}
            <div className="ob2__tape">
              {b.order_number && <p className="ob2__order">{b.order_number}</p>}

              <ul className="ob2__items">
                {b.items.map((i) => (
                  <li key={i.id} className="ob2__item">
                    <span className="ob2__itemName">
                      {locale === 'es' && i.description_es ? i.description_es : i.description}
                      {i.quantity > 1 && <span className="ob2__x"> ×{i.quantity}</span>}
                    </span>
                    <span className="ob2__dots" aria-hidden="true" />
                    <span className="ob2__itemPrice">
                      {centsToDisplay(i.unit_price_cents * i.quantity, locale)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="ob2__sums">
                <div className="ob2__sumRow">
                  <span>{t.subtotal}</span>
                  <span>{centsToDisplay(b.subtotal_cents, locale)}</span>
                </div>
                {b.shipping_cents > 0 && (
                  <div className="ob2__sumRow">
                    <span>{t.shipping}</span>
                    <span>{centsToDisplay(b.shipping_cents, locale)}</span>
                  </div>
                )}
                {b.discount_cents > 0 && (
                  <div className="ob2__sumRow">
                    <span>{t.discount}</span>
                    <span>−{centsToDisplay(b.discount_cents, locale)}</span>
                  </div>
                )}
                <div className="ob2__sumRow ob2__sumRow--total">
                  <span>{t.total}</span>
                  <span>{centsToDisplay(b.total_cents, locale)}</span>
                </div>
              </div>
            </div>

            {/* How to pay — only while there's a balance to settle. */}
            {b.status === 'finalized' && (
              <div className="ob2__pay">
                <p className="ob2__payLabel">{t.howToPay}</p>
                <p className={instructions ? 'ob2__inst' : 'ob2__inst ob2__muted'}>
                  {instructions || t.noInstructions}
                </p>
                {b.due_at && (
                  <p className="ob2__due">
                    {t.dueBy}{' '}
                    {new Date(b.due_at).toLocaleString(locale === 'es' ? 'es-US' : 'en-US', {
                      weekday: 'long',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                )}
                <button
                  className="ob2__btn"
                  disabled={payingId === b.id}
                  onClick={() => startCheckout(b.id)}
                >
                  {payingId === b.id ? t.payOpening : t.payCard}
                </button>
              </div>
            )}

            {paid && b.tracking_number && (
              <div className="ob2__track">
                <span className="ob2__trackLabel">{t.tracking}</span>
                <span className="ob2__trackNo">
                  {b.carrier ? `${b.carrier} · ` : ''}
                  {b.tracking_number}
                </span>
                <a
                  className="ob2__btn ob2__btn--ghost"
                  href={b.tracking_url || trackUrl(b.tracking_number)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.track}
                </a>
              </div>
            )}
          </article>
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
