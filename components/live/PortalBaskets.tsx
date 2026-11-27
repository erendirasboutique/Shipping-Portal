'use client';

import { useCallback, useEffect, useState } from 'react';
import { centsToDisplay, formatSaleDate } from '@/lib/live/money';

type PortalItem = {
  id: string;
  description: string;
  description_es: string | null;
  quantity: number;
  unit_price_cents: number | null;
  photo_url: string | null;
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
  package_photo_url?: string | null;
  carrier: string | null;
  subtotal_cents: number | null;
  shipping_cents: number | null;
  discount_cents: number | null;
  total_cents: number | null;
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
    liveSaleLine: 'Live sale',
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
    payError: 'Payment could not start. Please try again or contact us.',
    noInstructions: 'We sent you a message with the payment options.',
    empty: 'Nothing here yet.',
    each: 'each',
    tracking: 'Tracking',
    track: 'Track your package',
    packagePhoto: 'Your package',
    payTitle: 'Pay today or in 4 payments',
    payFrom: 'From',
    payEvery: 'every two weeks, nothing extra to do.',
    payNow: 'Pay',
    paySecure: 'Card, Apple Pay or installments · secure checkout by Stripe',
    otherWays: 'Prefer another way?',
    otherNote: 'Put #{n} in the payment note so we find it fast.',
    reported: 'I paid · send screenshot',
    reportHow: 'How did you pay?',
    reportPhoto: 'Screenshot of your payment',
    reportSend: 'Send',
    reportSending: 'Sending…',
    reportNeed: 'Pick how you paid and add the screenshot.',
    reportError: 'It did not send. Try again or message us.',
    cancel: 'Cancel',
  },
  es: {
    heading: 'Tu canasta',
    liveSaleLine: 'Venta en vivo',
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
    payError: 'No se pudo iniciar el pago. Intenta de nuevo o contáctanos.',
    noInstructions: 'Te enviamos un mensaje con las opciones de pago.',
    empty: 'Nada por aquí todavía.',
    each: 'c/u',
    tracking: 'Rastreo',
    track: 'Rastrea tu paquete',
    packagePhoto: 'Tu paquete',
    payTitle: 'Paga hoy o en 4 pagos',
    payFrom: 'Desde',
    payEvery: 'cada dos semanas, sin hacer nada extra.',
    payNow: 'Pagar',
    paySecure: 'Tarjeta, Apple Pay o en pagos · pago seguro con Stripe',
    otherWays: '¿Prefieres otra forma?',
    otherNote: 'Pon #{n} en la nota del pago para encontrarlo rápido.',
    reported: 'Ya pagué · mandar captura',
    reportHow: '¿Cómo pagaste?',
    reportPhoto: 'Captura de tu pago',
    reportSend: 'Mandar',
    reportSending: 'Enviando…',
    reportNeed: 'Elige cómo pagaste y agrega la captura.',
    reportError: 'No se mandó. Intenta otra vez o escríbenos.',
    cancel: 'Cancelar',
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

  // "Ya pagué": she reports a Zelle / Venmo / Cash App... payment with a
  // screenshot. The basket shows as paid; Saturday's scan shows it as
  // "por confirmar" until someone checks the app.
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportMethod, setReportMethod] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportErr, setReportErr] = useState<string | null>(null);

  async function sendReport(basketId: string) {
    if (!reportMethod || !reportFile) {
      setReportErr(copy[locale].reportNeed);
      return;
    }
    setReportBusy(true);
    setReportErr(null);
    try {
      const fd = new FormData();
      fd.append('paymentMethod', reportMethod);
      fd.append('paymentProof', reportFile);
      const res = await fetch(`/api/live/portal/${token}/baskets/${basketId}/mark-paid`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('report');
      setReportId(null);
      setReportFile(null);
      setReportMethod('');
      await load();
    } catch {
      setReportErr(copy[locale].reportError);
    }
    setReportBusy(false);
  }

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
        // Straight to Stripe's hosted page — card + BNPL live there.
        window.location.href = json.url;
        return;
      }
      // Show why, rather than a button that just does nothing.
      setError(json.error ?? t.payError);
      setPayingId(null);
    } catch {
      setError(t.payError);
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
                <span className="ob2__heroTotal">{centsToDisplay(b.total_cents ?? 0, locale)}</span>
                {b.sale_date && (
                  <span className="ob2__heroFrom">
                    {t.from} {b.sale_title || formatSaleDate(b.sale_date, locale)}
                  </span>
                )}
              </div>
              <span className={`ob2__stamp ob2__stamp--${b.status}`}>{statusLabel(b.status)}</span>
            </div>

            {/* Receipt tape: the itemization, as a boutique receipt. Baskets
                sent as a photo + total (the team stations) have no items:
                the photo and total above already say it all. */}
            {b.items.length > 0 && (
            <div className="ob2__tape">
              {b.order_number && <p className="ob2__order">{b.order_number}</p>}

              <ul className="ob2__items">
                {b.items.length === 0 && (
                  <li className="ob2__item ob2__item--single">
                    <span className="ob2__itemName">{t.liveSaleLine}</span>
                    <span className="ob2__dots" aria-hidden="true" />
                    <span className="ob2__itemPrice">
                      {centsToDisplay(b.total_cents ?? 0, locale)}
                    </span>
                  </li>
                )}
                {b.items.map((i) => (
                  <li key={i.id} className="ob2__item">
                    {i.photo_url && (
                      <img className="ob2__itemThumb" src={i.photo_url} alt="" loading="lazy" />
                    )}
                    <span className="ob2__itemName">
                      {locale === 'es' && i.description_es ? i.description_es : i.description}
                      {i.quantity > 1 && <span className="ob2__x"> ×{i.quantity}</span>}
                    </span>
                    <span className="ob2__dots" aria-hidden="true" />
                    <span className="ob2__itemPrice">
                      {centsToDisplay((i.unit_price_cents ?? 0) * i.quantity, locale)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="ob2__sums">
                <div className="ob2__sumRow">
                  <span>{t.subtotal}</span>
                  <span>{centsToDisplay(b.subtotal_cents ?? 0, locale)}</span>
                </div>
                {(b.shipping_cents ?? 0) > 0 && (
                  <div className="ob2__sumRow">
                    <span>{t.shipping}</span>
                    <span>{centsToDisplay(b.shipping_cents ?? 0, locale)}</span>
                  </div>
                )}
                {(b.discount_cents ?? 0) > 0 && (
                  <div className="ob2__sumRow">
                    <span>{t.discount}</span>
                    <span>−{centsToDisplay(b.discount_cents ?? 0, locale)}</span>
                  </div>
                )}
                <div className="ob2__sumRow ob2__sumRow--total">
                  <span>{t.total}</span>
                  <span>{centsToDisplay(b.total_cents ?? 0, locale)}</span>
                </div>
              </div>
            </div>
            )}
            {b.items.length === 0 && b.order_number && (
              <div className="ob2__tape"><p className="ob2__order">{b.order_number}</p></div>
            )}

            {/* How to pay — only while there's a balance to settle. Card and
                pay-in-4 (Klarna, Afterpay, Zip, Affirm through Stripe) first,
                then the other ways and "Ya pagué". */}
            {b.status === 'finalized' && (
              <div className="ob2__pay">
                <div className="ob2__bnpl">
                  <p className="ob2__bnplTitle">{t.payTitle}</p>
                  {(b.total_cents ?? 0) >= 4000 && (
                    <p className="ob2__bnplFrom">
                      {t.payFrom} <strong>{centsToDisplay(Math.ceil((b.total_cents ?? 0) / 4), locale)}</strong> {t.payEvery}
                    </p>
                  )}
                  <ul className="ob2__bnplNames" aria-label="Klarna, Afterpay, Zip, Affirm">
                    <li>Klarna</li>
                    <li>Afterpay</li>
                    <li>Zip</li>
                    <li>Affirm</li>
                  </ul>
                  <button
                    className="ob2__btn ob2__btn--big"
                    disabled={payingId === b.id}
                    onClick={() => startCheckout(b.id)}
                  >
                    {payingId === b.id ? t.payOpening : `${t.payNow} ${centsToDisplay(b.total_cents ?? 0, locale)}`}
                  </button>
                  <p className="ob2__bnplSecure">{t.paySecure}</p>
                  {error && payingId === null && <p className="ob2__payErr">{error}</p>}
                </div>

                <p className="ob2__payLabel">{t.otherWays}</p>
                <p className={instructions ? 'ob2__inst' : 'ob2__inst ob2__muted'}>
                  {instructions || t.noInstructions}
                </p>
                <p className="ob2__inst ob2__muted">{t.otherNote.replace('{n}', String(b.basket_number))}</p>
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

                {reportId !== b.id ? (
                  <button className="ob2__btn ob2__btn--ghost" onClick={() => { setReportId(b.id); setReportErr(null); }}>
                    {t.reported}
                  </button>
                ) : (
                  <div className="ob2__report">
                    <p className="ob2__payLabel">{t.reportHow}</p>
                    <div className="ob2__methods" role="radiogroup" aria-label={t.reportHow}>
                      {[
                        ['zelle', 'Zelle'],
                        ['cash_app', 'Cash App'],
                        ['venmo', 'Venmo'],
                        ['paypal', 'PayPal'],
                        ['apple_pay', 'Apple Pay'],
                        ['other', locale === 'es' ? 'Otro' : 'Other'],
                      ].map(([v, label]) => (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={reportMethod === v}
                          className={'ob2__method' + (reportMethod === v ? ' ob2__method--on' : '')}
                          onClick={() => setReportMethod(v)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="ob2__payLabel" htmlFor={'proof-' + b.id}>{t.reportPhoto}</label>
                    <input
                      id={'proof-' + b.id}
                      type="file"
                      accept="image/*"
                      className="ob2__file"
                      onChange={(e) => setReportFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                    />
                    {reportErr && <p className="ob2__payErr">{reportErr}</p>}
                    <button className="ob2__btn" disabled={reportBusy} onClick={() => sendReport(b.id)}>
                      {reportBusy ? t.reportSending : t.reportSend}
                    </button>
                    <button className="ob2__btn ob2__btn--ghost" onClick={() => setReportId(null)}>{t.cancel}</button>
                  </div>
                )}
              </div>
            )}

            {paid && b.package_photo_url && (
              <div className="ob2__track">
                <span className="ob2__trackLabel">{t.packagePhoto}</span>
                <a href={b.package_photo_url} target="_blank" rel="noreferrer">
                  <img
                    src={b.package_photo_url}
                    alt={t.packagePhoto}
                    loading="lazy"
                    style={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 8, marginTop: 6, display: 'block' }}
                  />
                </a>
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
