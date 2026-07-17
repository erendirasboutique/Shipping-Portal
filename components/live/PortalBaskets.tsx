'use client';

import { useEffect, useState } from 'react';
import { centsToDisplay } from '@/lib/live/money';

type PortalItem = {
  id: string;
  description: string;
  description_es: string | null;
  photo_url: string | null;
  quantity: number;
  unit_price_cents: number;
};

type PortalBasket = {
  id: string;
  basket_number: number;
  status: string;
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  item_count: number;
  pay_url: string | null;
  paid_at: string | null;
  items: PortalItem[];
};

const copy = {
  en: {
    heading: 'Your basket',
    forming: 'Still adding items — your total lands Thursday night.',
    ready: 'Ready to pay',
    paid: 'Paid — shipping Saturday',
    released: 'This basket was released. The items went back to the rack.',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    discount: 'Discount',
    total: 'Total',
    pay: 'Pay now',
    empty: 'Nothing here yet. Your basket shows up once you claim something on the live.',
    each: 'each',
  },
  es: {
    heading: 'Tu canasta',
    forming: 'Todavía agregando artículos — tu total llega el jueves por la noche.',
    ready: 'Lista para pagar',
    paid: 'Pagada — se envía el sábado',
    released: 'Esta canasta se liberó. Los artículos volvieron al perchero.',
    subtotal: 'Subtotal',
    shipping: 'Envío',
    discount: 'Descuento',
    total: 'Total',
    pay: 'Pagar ahora',
    empty: 'Nada por aquí todavía. Tu canasta aparece cuando apartas algo en el live.',
    each: 'c/u',
  },
} as const;

export default function PortalBaskets({
  token,
  locale: forced,
}: {
  token: string;
  /** Omit to auto-detect from the browser, matching the rest of the portal. */
  locale?: 'en' | 'es';
}) {
  const [locale, setLocale] = useState<'en' | 'es'>(forced ?? 'en');
  const [baskets, setBaskets] = useState<PortalBasket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (forced) return;
    const lang = navigator.language?.toLowerCase() ?? '';
    if (lang.startsWith('es')) setLocale('es');
  }, [forced]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/live/portal/${token}/baskets`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? 'We could not load your basket.');
          return;
        }
        setBaskets(json.baskets ?? []);
      } catch {
        if (!cancelled) setError('We could not load your basket. Refresh to try again.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const t = copy[locale];

  if (error) {
    return (
      <div className="live">
        <p style={{ color: 'var(--alert)' }}>{error}</p>
      </div>
    );
  }

  if (baskets === null) {
    return (
      <div className="live">
        <p className="live__muted">…</p>
      </div>
    );
  }

  if (baskets.length === 0) {
    return (
      <div className="live">
        <div className="live__empty">
          <p className="live__muted" style={{ margin: 0 }}>
            {t.empty}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="live" style={{ background: 'transparent', minHeight: 0 }}>
      <div style={{ display: 'grid', gap: 24 }}>
        {baskets.map((basket) => (
          <section key={basket.id} className="live__card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <h2>
                {t.heading}{' '}
                <span className="live__mono live__muted">#{basket.basket_number}</span>
              </h2>
              <span className={`live__pill live__pill--${basket.status}`}>
                {basket.status === 'open'
                  ? t.forming
                  : basket.status === 'finalized'
                    ? t.ready
                    : basket.status === 'released'
                      ? t.released
                      : t.paid}
              </span>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {basket.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '64px 1fr auto',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  {item.photo_url ? (
                    <img
                      src={item.photo_url}
                      alt=""
                      loading="lazy"
                      style={{
                        width: 64,
                        height: 80,
                        objectFit: 'cover',
                        borderRadius: 2,
                        background: 'rgba(189,168,145,0.2)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 64,
                        height: 80,
                        borderRadius: 2,
                        background: 'rgba(189,168,145,0.2)',
                      }}
                    />
                  )}

                  <div>
                    <p style={{ margin: 0, fontSize: '0.9375rem' }}>
                      {locale === 'es' && item.description_es
                        ? item.description_es
                        : item.description}
                    </p>
                    {item.quantity > 1 && (
                      <p className="live__muted live__mono" style={{ margin: 0, fontSize: '0.75rem' }}>
                        ×{item.quantity} · {centsToDisplay(item.unit_price_cents, locale)} {t.each}
                      </p>
                    )}
                  </div>

                  <span className="live__mono">
                    {centsToDisplay(item.unit_price_cents * item.quantity, locale)}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: '1px solid var(--line)',
                display: 'grid',
                gap: 6,
              }}
            >
              <Row label={t.subtotal} value={centsToDisplay(basket.subtotal_cents, locale)} />
              {basket.shipping_cents > 0 && (
                <Row label={t.shipping} value={centsToDisplay(basket.shipping_cents, locale)} />
              )}
              {basket.discount_cents > 0 && (
                <Row
                  label={t.discount}
                  value={`−${centsToDisplay(basket.discount_cents, locale)}`}
                />
              )}
              <Row
                label={t.total}
                value={centsToDisplay(basket.total_cents, locale)}
                strong
              />
            </div>

            {basket.pay_url && (
              <a
                className="live__btn"
                href={basket.pay_url}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  textDecoration: 'none',
                  marginTop: 20,
                }}
              >
                {t.pay}
              </a>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span className={strong ? undefined : 'live__muted'} style={{ fontSize: '0.9375rem' }}>
        {label}
      </span>
      <span
        className="live__mono"
        style={{ fontSize: strong ? '1.125rem' : '0.9375rem', fontWeight: strong ? 600 : 400 }}
      >
        {value}
      </span>
    </div>
  );
}
