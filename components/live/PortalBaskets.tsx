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
    howToPay: 'Payment details',
    dueBy: 'Please pay by',
    payCard: 'Continue to secure checkout',
    payOpening: 'Opening secure checkout…',
    payError: 'Payment could not start. Please try again or contact us.',
    noInstructions: 'We sent you a message with the payment options.',
    empty: 'Nothing here yet.',
    each: 'each',
    tracking: 'Tracking',
    track: 'Track your package',
    items: 'items',
    orderSummary: 'Order summary',
    liveOrder: 'Live order',
    secure: 'Secure payment powered by Stripe',
    saveImage: 'Save basket image',
    alreadyPaid: 'Already paid? Click here',
    confirmPaid: 'Confirm that you already sent your payment?',
    markingPaid: 'Marking as paid…',
    markedPaid: 'Payment reported successfully.',
    markPaidError: 'We could not mark this basket as paid. Please contact us.',
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
    howToPay: 'Detalles de pago',
    dueBy: 'Por favor paga antes del',
    payCard: 'Continuar al pago seguro',
    payOpening: 'Abriendo pago seguro…',
    payError: 'No se pudo iniciar el pago. Intenta de nuevo o contáctanos.',
    noInstructions: 'Te enviamos un mensaje con las opciones de pago.',
    empty: 'Nada por aquí todavía.',
    each: 'c/u',
    tracking: 'Rastreo',
    track: 'Rastrear paquete',
    items: 'artículos',
    orderSummary: 'Resumen del pedido',
    liveOrder: 'Pedido del live',
    secure: 'Pago seguro procesado por Stripe',
    saveImage: 'Guardar imagen de la canasta',
    alreadyPaid: '¿Ya pagaste? — Haz clic aquí',
    confirmPaid: '¿Confirmas que ya enviaste tu pago?',
    markingPaid: 'Marcando como pagada…',
    markedPaid: 'Tu pago fue reportado correctamente.',
    markPaidError: 'No pudimos marcar la canasta como pagada. Por favor contáctanos.',
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
  const [payingId, setPayingId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [paidMessageId, setPaidMessageId] = useState<string | null>(null);

  const t = copy[locale];

  async function startCheckout(basketId: string) {
    setPayingId(basketId);
    setError(null);

    try {
      const res = await fetch(`/api/live/portal/${token}/baskets/${basketId}/pay`, {
        method: 'POST',
        cache: 'no-store',
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }

      setError(json.error ?? t.payError);
      setPayingId(null);
    } catch {
      setError(t.payError);
      setPayingId(null);
    }
  }


  async function reportPayment(basketId: string) {
    if (!window.confirm(t.confirmPaid)) return;

    setMarkingPaidId(basketId);
    setPaidMessageId(null);
    setError(null);

    try {
      const res = await fetch(
        `/api/live/portal/${token}/baskets/${basketId}/mark-paid`,
        {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json.error ?? t.markPaidError);
        setMarkingPaidId(null);
        return;
      }

      setPaidMessageId(basketId);
      setMarkingPaidId(null);
      await load();
    } catch {
      setError(t.markPaidError);
      setMarkingPaidId(null);
    }
  }

  useEffect(() => {
    if (forced) return;

    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('lang') === 'en') setLocale('en');
    } catch {
      // Spanish remains the default.
    }
  }, [forced]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/portal/${token}/baskets`, {
        cache: 'no-store',
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'We could not load your basket.');
        return;
      }

      setBaskets(json.baskets ?? []);
      setError(null);
    } catch {
      // Keep the latest basket visible if the connection drops.
    }
  }, [token]);

  useEffect(() => {
    load();

    let timer: number | undefined;

    function stop() {
      if (timer) window.clearInterval(timer);
      timer = undefined;
    }

    function start() {
      stop();
      timer = window.setInterval(load, 20000);
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

  function statusLabel(status: string) {
    if (status === 'open') return t.forming;
    if (status === 'finalized') return t.ready;
    if (status === 'released') return t.released;
    if (status === 'shipped') return t.shipped;
    return t.paid;
  }

  async function saveBasketImage(url: string, basketNumber: number) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');

      anchor.href = objectUrl;
      anchor.download = `erendiras-boutique-canasta-${basketNumber}.jpg`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  if (error && baskets === null) {
    return (
      <div className="portalState portalState--error">
        <span>!</span>
        <p>{error}</p>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (baskets === null) {
    return (
      <div className="portalState">
        <span className="loader" />
        <p>Cargando tu canasta…</p>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (baskets.length === 0) {
    return (
      <div className="portalState">
        <span>♡</span>
        <p>{t.empty}</p>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <section className="portal">
      <header className="portalHeader">
        <div>
          <p className="portalHeader__brand">Erendira&apos;s Boutique</p>
          <h1>{t.heading}</h1>
        </div>

        {!forced && (
          <div className="languageToggle" aria-label="Language selector">
            <button
              type="button"
              className={locale === 'es' ? 'active' : ''}
              onClick={() => setLocale('es')}
            >
              ES
            </button>
            <button
              type="button"
              className={locale === 'en' ? 'active' : ''}
              onClick={() => setLocale('en')}
            >
              EN
            </button>
          </div>
        )}
      </header>

      <div className="basketStack">
        {baskets.map((b) => {
          const instructions =
            locale === 'es' && b.payment_instructions_es
              ? b.payment_instructions_es
              : b.payment_instructions;

          const paid = b.status === 'paid' || b.status === 'shipped';

          return (
            <article key={b.id} className="shopCard">
              <div className="shopCard__media">
                <div className="shopCard__imageStage">
                  {b.photo_url ? (
                    <img
                      src={b.photo_url}
                      alt={`${t.basket} #${b.basket_number}`}
                    />
                  ) : (
                    <div className="shopCard__placeholder">
                      <span>EB</span>
                    </div>
                  )}
                </div>

                <div className="shopCard__mediaTop">
                  <span className={`status status--${b.status}`}>
                    <span className="status__dot" />
                    {statusLabel(b.status)}
                  </span>
                </div>

                <div className="shopCard__mediaBottom">
                  <div>
                    <span>{t.liveOrder}</span>
                    <strong>#{b.basket_number}</strong>
                  </div>

                  {b.photo_url && (
                    <button
                      type="button"
                      className="saveImageButton"
                      onClick={() => saveBasketImage(b.photo_url as string, b.basket_number)}
                    >
                      <span aria-hidden="true">↓</span>
                      {t.saveImage}
                    </button>
                  )}
                </div>
              </div>

              <div className="shopCard__content">
                <div className="shopCard__intro">
                  <div>
                    <p className="shopCard__eyebrow">
                      {t.basket} #{b.basket_number}
                    </p>
                    <h2>
                      {b.sale_title ||
                        (b.sale_date
                          ? formatSaleDate(b.sale_date, locale)
                          : t.orderSummary)}
                    </h2>
                    {b.sale_date && (
                      <p className="shopCard__date">
                        {t.from} {formatSaleDate(b.sale_date, locale)}
                      </p>
                    )}
                  </div>

                  <p className="shopCard__total">
                    {centsToDisplay(b.total_cents, locale)}
                  </p>
                </div>

                <div className="shopCard__meta">
                  <span>
                    {b.item_count} {t.items}
                  </span>
                  {b.order_number && <span>Order #{b.order_number}</span>}
                </div>

                <div className="lineItems">
                  {b.items.map((i) => (
                    <div key={i.id} className="lineItem">
                      <div className="lineItem__qty">{i.quantity}</div>

                      <div className="lineItem__details">
                        <p>
                          {locale === 'es' && i.description_es
                            ? i.description_es
                            : i.description}
                        </p>
                        <span>
                          {centsToDisplay(i.unit_price_cents, locale)} {t.each}
                        </span>
                      </div>

                      <strong>
                        {centsToDisplay(i.unit_price_cents * i.quantity, locale)}
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="summary">
                  <div>
                    <span>{t.subtotal}</span>
                    <strong>{centsToDisplay(b.subtotal_cents, locale)}</strong>
                  </div>

                  {b.shipping_cents > 0 && (
                    <div>
                      <span>{t.shipping}</span>
                      <strong>{centsToDisplay(b.shipping_cents, locale)}</strong>
                    </div>
                  )}

                  {b.discount_cents > 0 && (
                    <div className="summary__discount">
                      <span>{t.discount}</span>
                      <strong>−{centsToDisplay(b.discount_cents, locale)}</strong>
                    </div>
                  )}

                  <div className="summary__total">
                    <span>{t.total}</span>
                    <strong>{centsToDisplay(b.total_cents, locale)}</strong>
                  </div>
                </div>

                {b.status === 'finalized' && (
                  <div className="paymentBox">
                    <div className="paymentBox__header">
                      <div>
                        <p>{t.howToPay}</p>
                        <span>{t.secure}</span>
                      </div>
                      <span className="paymentBox__lock">⌁</span>
                    </div>

                    <p className="paymentBox__instructions">
                      {instructions || t.noInstructions}
                    </p>

                    {b.due_at && (
                      <p className="paymentBox__due">
                        {t.dueBy}{' '}
                        <strong>
                          {new Date(b.due_at).toLocaleString(
                            locale === 'es' ? 'es-US' : 'en-US',
                            {
                              weekday: 'long',
                              hour: 'numeric',
                              minute: '2-digit',
                            },
                          )}
                        </strong>
                      </p>
                    )}

                    <button
                      type="button"
                      className="checkoutButton"
                      disabled={payingId === b.id || markingPaidId === b.id}
                      onClick={() => startCheckout(b.id)}
                    >
                      <span>
                        {payingId === b.id ? t.payOpening : t.payCard}
                      </span>
                      {payingId === b.id ? (
                        <span className="buttonLoader" />
                      ) : (
                        <span aria-hidden="true">→</span>
                      )}
                    </button>

                    <button
                      type="button"
                      className="alreadyPaidButton"
                      disabled={markingPaidId === b.id || payingId === b.id}
                      onClick={() => reportPayment(b.id)}
                    >
                      {markingPaidId === b.id ? (
                        <>
                          <span className="buttonLoader buttonLoader--brand" />
                          <span>{t.markingPaid}</span>
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true">✓</span>
                          <span>{t.alreadyPaid}</span>
                        </>
                      )}
                    </button>

                    {paidMessageId === b.id && (
                      <p className="paidSuccess">{t.markedPaid}</p>
                    )}

                    {error && payingId === null && markingPaidId === null && (
                      <p className="paymentError">{error}</p>
                    )}
                  </div>
                )}

                {paid && b.tracking_number && (
                  <div className="trackingBox">
                    <div>
                      <p>{t.tracking}</p>
                      <span>
                        {b.carrier ? `${b.carrier} · ` : ''}
                        {b.tracking_number}
                      </span>
                    </div>

                    <a
                      href={b.tracking_url || trackUrl(b.tracking_number)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t.track}
                      <span>↗</span>
                    </a>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <style jsx>{styles}</style>
    </section>
  );
}

const styles = `
  @font-face {
    font-family: 'La Luxes Serif';
    src:
      url('/fonts/LaLuxesSerif.woff2') format('woff2'),
      url('/fonts/LaLuxesSerif.otf') format('opentype'),
      url('/fonts/laluxesserif.otf') format('opentype');
    font-display: swap;
  }

  @font-face {
    font-family: 'Recoleta';
    src:
      url('/fonts/Recoleta.woff2') format('woff2'),
      url('/fonts/Recoleta.otf') format('opentype'),
      url('/fonts/recoleta.otf') format('opentype');
    font-display: swap;
  }

  .portal {
    --background: #f5f3ef;
    --brand: #957f67;
    --accent: #cfbda9;
    --white: #fffdf9;
    --ink: #675746;
    --muted: #8f8174;
    --line: rgba(149, 127, 103, 0.22);
    --soft: rgba(207, 189, 169, 0.22);

    width: 100%;
    padding: 34px;
    border-radius: 24px;
    background: var(--background);
    color: var(--brand);
    font-family: 'Recoleta', Georgia, serif;
  }

  .portalHeader {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    max-width: 1180px;
    margin: 0 auto 28px;
  }

  .portalHeader__brand {
    margin: 0 0 7px;
    color: var(--brand);
    font-size: 0.74rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .portalHeader h1,
  .shopCard__intro h2 {
    font-family: 'La Luxes Serif', 'Times New Roman', serif;
    font-weight: 400;
  }

  .portalHeader h1 {
    margin: 0;
    color: var(--brand);
    font-size: clamp(2.5rem, 5vw, 4.6rem);
    line-height: 0.92;
  }

  .languageToggle {
    display: flex;
    gap: 3px;
    padding: 4px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: rgba(255, 253, 249, 0.6);
  }

  .languageToggle button {
    min-width: 42px;
    border: 0;
    border-radius: 5px;
    padding: 9px 11px;
    background: transparent;
    color: var(--brand);
    font: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
  }

  .languageToggle button.active {
    background: var(--brand);
    color: var(--background);
  }

  .basketStack {
    display: grid;
    gap: 26px;
    max-width: 1180px;
    margin: 0 auto;
  }

  .shopCard {
    display: grid;
    grid-template-columns: minmax(460px, 1.05fr) minmax(460px, 0.95fr);
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--white);
    box-shadow: 0 10px 34px rgba(107, 90, 71, 0.06);
  }

  .shopCard__media {
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 640px;
    padding: 72px 28px 92px;
    overflow: hidden;
    background: var(--accent);
  }

  .shopCard__imageStage {
    display: grid;
    place-items: center;
    width: 100%;
    min-height: 470px;
    overflow: hidden;
    border-radius: 8px;
    background: rgba(245, 243, 239, 0.5);
  }

  .shopCard__imageStage img {
    display: block;
    width: 100%;
    height: 100%;
    max-height: 560px;
    object-fit: contain;
    object-position: center;
  }

  .shopCard__placeholder {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    min-height: 470px;
    background: var(--accent);
  }

  .shopCard__placeholder span {
    display: grid;
    place-items: center;
    width: 92px;
    height: 92px;
    border: 1px solid rgba(245, 243, 239, 0.75);
    border-radius: 50%;
    color: var(--background);
    font-family: 'La Luxes Serif', serif;
    font-size: 1.9rem;
  }


  .shopCard__mediaTop,
  .shopCard__mediaBottom {
    position: absolute;
    z-index: 1;
    right: 20px;
    left: 20px;
  }

  .shopCard__mediaTop {
    top: 20px;
  }

  .shopCard__mediaBottom {
    bottom: 20px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    color: var(--background);
  }

  .shopCard__mediaBottom > div span,
  .shopCard__mediaBottom > div strong {
    display: block;
  }

  .shopCard__mediaBottom > div span {
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .shopCard__mediaBottom > div strong {
    margin-top: 3px;
    font-family: 'La Luxes Serif', serif;
    font-size: 2rem;
    font-weight: 400;
  }

  .saveImageButton {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    border: 1px solid rgba(245, 243, 239, 0.72);
    border-radius: 7px;
    padding: 9px 12px;
    background: rgba(245, 243, 239, 0.92);
    color: var(--brand);
    font: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 160ms ease,
      color 160ms ease;
  }

  .saveImageButton:hover {
    background: var(--brand);
    color: var(--background);
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(245, 243, 239, 0.62);
    border-radius: 999px;
    padding: 8px 11px;
    background: rgba(245, 243, 239, 0.88);
    color: var(--brand);
    backdrop-filter: blur(10px);
    font-size: 0.69rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .status__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--brand);
  }

  .status--paid .status__dot,
  .status--shipped .status__dot,
  .status--released .status__dot {
    background: #778568;
  }

  .shopCard__content {
    padding: 34px;
  }

  .shopCard__intro {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    padding-bottom: 22px;
    border-bottom: 1px solid var(--line);
  }

  .shopCard__eyebrow {
    margin: 0 0 8px;
    color: var(--accent);
    font-size: 0.73rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .shopCard__intro h2 {
    max-width: 520px;
    margin: 0;
    color: var(--brand);
    font-size: clamp(2rem, 4vw, 3.15rem);
    line-height: 1;
  }

  .shopCard__date {
    margin: 10px 0 0;
    color: var(--muted);
    font-size: 0.83rem;
  }

  .shopCard__total {
    margin: 0;
    color: var(--brand);
    font-family: 'La Luxes Serif', serif;
    font-size: clamp(2rem, 4vw, 3.1rem);
    line-height: 1;
    white-space: nowrap;
  }

  .shopCard__meta {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 15px 0;
    color: var(--muted);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .lineItems {
    border-top: 1px solid var(--line);
  }

  .lineItem {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto;
    align-items: center;
    gap: 13px;
    padding: 16px 0;
    border-bottom: 1px solid var(--line);
  }

  .lineItem__qty {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--line);
    border-radius: 50%;
    color: var(--brand);
    font-size: 0.77rem;
    font-weight: 600;
  }

  .lineItem__details p,
  .lineItem__details span {
    display: block;
  }

  .lineItem__details p {
    margin: 0;
    color: var(--ink);
    font-size: 0.94rem;
  }

  .lineItem__details span {
    margin-top: 4px;
    color: var(--muted);
    font-size: 0.76rem;
  }

  .lineItem > strong {
    color: var(--brand);
    font-size: 0.88rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .summary {
    display: grid;
    gap: 11px;
    margin-top: 22px;
    padding: 20px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--background);
  }

  .summary > div {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    color: var(--muted);
    font-size: 0.84rem;
  }

  .summary strong {
    color: var(--brand);
    font-weight: 600;
  }

  .summary__discount,
  .summary__discount strong {
    color: #778568 !important;
  }

  .summary__total {
    margin-top: 4px;
    padding-top: 13px;
    border-top: 1px solid var(--line);
    color: var(--brand) !important;
    font-size: 1rem !important;
  }

  .summary__total strong {
    font-family: 'La Luxes Serif', serif;
    font-size: 1.5rem;
    font-weight: 400;
  }

  .paymentBox,
  .trackingBox {
    margin-top: 18px;
    border: 1px solid var(--line);
    border-radius: 10px;
  }

  .paymentBox {
    padding: 20px;
    background: rgba(207, 189, 169, 0.13);
  }

  .paymentBox__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 14px;
  }

  .paymentBox__header p,
  .paymentBox__header span,
  .paymentBox__instructions,
  .paymentBox__due {
    margin: 0;
  }

  .paymentBox__header p {
    color: var(--brand);
    font-family: 'La Luxes Serif', serif;
    font-size: 1.5rem;
  }

  .paymentBox__header div > span {
    display: block;
    margin-top: 3px;
    color: var(--muted);
    font-size: 0.73rem;
  }

  .paymentBox__lock {
    color: var(--accent);
    font-size: 1.4rem;
  }

  .paymentBox__instructions {
    color: var(--ink);
    font-size: 0.84rem;
    line-height: 1.6;
    white-space: pre-line;
  }

  .paymentBox__due {
    margin-top: 13px;
    color: var(--muted);
    font-size: 0.76rem;
    line-height: 1.5;
  }

  .paymentBox__due strong {
    color: var(--brand);
    font-weight: 600;
  }

  .checkoutButton {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    width: 100%;
    min-height: 50px;
    margin-top: 17px;
    border: 1px solid var(--brand);
    border-radius: 7px;
    padding: 13px 16px;
    background: var(--brand);
    color: var(--background);
    font: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  .checkoutButton:hover:not(:disabled) {
    transform: translateY(-1px);
    background: transparent;
    color: var(--brand);
  }

  .checkoutButton:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .buttonLoader,
  .loader {
    display: inline-block;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .buttonLoader {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(245, 243, 239, 0.35);
    border-top-color: var(--background);
  }


  .alreadyPaidButton {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    width: 100%;
    min-height: 47px;
    margin-top: 10px;
    border: 1px solid var(--brand);
    border-radius: 7px;
    padding: 12px 16px;
    background: transparent;
    color: var(--brand);
    font: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 160ms ease,
      color 160ms ease;
  }

  .alreadyPaidButton:hover:not(:disabled) {
    background: var(--accent);
    color: var(--ink);
  }

  .alreadyPaidButton:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .buttonLoader--brand {
    border-color: rgba(149, 127, 103, 0.22);
    border-top-color: var(--brand);
  }

  .paidSuccess {
    margin: 11px 0 0;
    color: #778568;
    font-size: 0.78rem;
    text-align: center;
  }

  .paymentError {
    margin: 10px 0 0;
    color: #9b5f5f;
    font-size: 0.78rem;
  }

  .trackingBox {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 17px 18px;
    background: var(--background);
  }

  .trackingBox p,
  .trackingBox span {
    display: block;
    margin: 0;
  }

  .trackingBox p {
    margin-bottom: 4px;
    color: var(--brand);
    font-family: 'La Luxes Serif', serif;
    font-size: 1.25rem;
  }

  .trackingBox div > span {
    color: var(--muted);
    font-size: 0.76rem;
  }

  .trackingBox a {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    border-bottom: 1px solid var(--brand);
    padding-bottom: 3px;
    color: var(--brand);
    font-size: 0.8rem;
    font-weight: 600;
    text-decoration: none;
  }

  .portalState {
    display: grid;
    justify-items: center;
    gap: 12px;
    border: 1px solid rgba(149, 127, 103, 0.22);
    border-radius: 14px;
    padding: 48px 24px;
    background: #f5f3ef;
    color: #957f67;
    font-family: 'Recoleta', Georgia, serif;
    text-align: center;
  }

  .portalState p {
    margin: 0;
  }

  .portalState > span:not(.loader) {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border: 1px solid rgba(149, 127, 103, 0.22);
    border-radius: 50%;
  }

  .portalState--error {
    color: #9b5f5f;
  }

  .loader {
    width: 27px;
    height: 27px;
    border: 3px solid rgba(149, 127, 103, 0.18);
    border-top-color: #957f67;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 980px) {
    .portal {
      padding: 22px;
    }

    .shopCard {
      grid-template-columns: 1fr;
    }

    .shopCard__media {
      min-height: 560px;
    }

    .shopCard__imageStage img {
      max-height: 430px;
    }
  }

  @media (max-width: 560px) {
    .portal {
      padding: 14px;
      border-radius: 18px;
    }

    .portalHeader {
      align-items: center;
      margin-bottom: 18px;
    }

    .portalHeader h1 {
      font-size: 2.65rem;
    }

    .portalHeader__brand {
      font-size: 0.61rem;
    }

    .languageToggle button {
      min-width: 36px;
      padding: 8px;
    }

    .basketStack {
      gap: 18px;
    }

    .shopCard {
      border-radius: 10px;
    }

    .shopCard__media {
      min-height: auto;
      padding: 68px 14px 92px;
    }

    .shopCard__imageStage {
      min-height: 330px;
    }

    .shopCard__imageStage img {
      max-height: 390px;
    }

    .shopCard__mediaBottom {
      align-items: center;
    }

    .saveImageButton {
      max-width: 190px;
    }

    .shopCard__content {
      padding: 21px;
    }

    .shopCard__intro {
      display: block;
    }

    .shopCard__total {
      margin-top: 14px;
    }

    .shopCard__meta {
      flex-wrap: wrap;
    }

    .trackingBox {
      display: grid;
    }

    .trackingBox a {
      width: max-content;
    }
  }


  @media (min-width: 1180px) {
    .portal {
      padding-inline: 48px;
    }

    .basketStack,
    .portalHeader {
      max-width: 1380px;
    }

    .shopCard__content {
      padding: 44px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .checkoutButton {
      transition: none;
    }
  }
`;
