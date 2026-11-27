'use client';

// The customer's order page (order.erendirasboutique.com/{token}), built
// to the "F · Mi canasta" mockup: her basket photo and total, then pay
// today or in 4 (Stripe: card, Apple Pay, Klarna, Afterpay, Zip, Affirm),
// then the other ways to pay and "Ya pagué", then a link to her account.
// Styles are in styles/order.css (classes start with mb-).

import { useCallback, useEffect, useState } from 'react';
import { BRAND_LOGO } from '@/lib/brand';

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
    hello: 'Hi',
    heading: 'Your live basket',
    headingMany: 'Your live baskets',
    photoAlt: 'Photo of your basket',
    totalShip: 'Total with shipping',
    total: 'Total',
    waiting: 'Waiting for your payment · ships Saturday',
    forming: 'Still adding to it',
    paid: 'Paid · ships Saturday',
    shipped: 'On its way',
    released: 'Released',
    details: 'What’s in it',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    discount: 'Discount',
    payTitle: 'Pay today or in 4 payments',
    payFrom: 'From',
    payEvery: 'every two weeks, nothing extra to do.',
    payPlain: 'Card or Apple Pay, or split it into payments.',
    payNow: 'Pay',
    payOpening: 'Opening secure checkout…',
    payError: 'Payment could not start. Please try again or message us.',
    paySecure: 'Card, Apple Pay or installments · secure checkout with Stripe',
    otherWays: 'Prefer another way?',
    otherNote: 'Put {n} in the payment note so we find it fast.',
    noInstructions: 'We sent you a message with the payment options.',
    dueBy: 'Please pay by',
    copied: 'Copied',
    reported: 'I paid · send screenshot',
    reportHow: 'How did you pay?',
    reportPhoto: 'Screenshot of your payment',
    reportPick: 'Choose screenshot',
    reportSend: 'Send',
    reportSending: 'Sending…',
    reportNeed: 'Pick how you paid and add the screenshot.',
    reportError: 'It didn’t send. Try again or message us.',
    cancel: 'Cancel',
    tracking: 'Tracking',
    track: 'Track your package',
    packagePhoto: 'Your package',
    account: 'See my orders and shipments',
    accountSub: 'Your full account',
    empty: 'Nothing here yet.',
    loadError: 'We couldn’t load your basket. Pull down to try again.',
    lang: 'ES',
    langLabel: 'Cambiar a español',
    other: 'Other',
  },
  es: {
    hello: 'Hola',
    heading: 'Tu canasta del live',
    headingMany: 'Tus canastas del live',
    photoAlt: 'Foto de tu canasta',
    totalShip: 'Total con envío',
    total: 'Total',
    waiting: 'Esperando tu pago · sale el sábado',
    forming: 'Todavía agregando',
    paid: 'Pagada · sale el sábado',
    shipped: 'Ya va en camino',
    released: 'Liberada',
    details: 'Lo que lleva',
    subtotal: 'Subtotal',
    shipping: 'Envío',
    discount: 'Descuento',
    payTitle: 'Paga hoy o en 4 pagos',
    payFrom: 'Desde',
    payEvery: 'cada dos semanas, sin hacer nada extra.',
    payPlain: 'Tarjeta o Apple Pay, o divídelo en pagos.',
    payNow: 'Pagar',
    payOpening: 'Abriendo pago seguro…',
    payError: 'No se pudo iniciar el pago. Intenta de nuevo o escríbenos.',
    paySecure: 'Tarjeta, Apple Pay o en pagos · pago seguro con Stripe',
    otherWays: '¿Prefieres otra forma?',
    otherNote: 'Pon {n} en la nota del pago para encontrarlo rápido.',
    noInstructions: 'Te mandamos un mensaje con las formas de pago.',
    dueBy: 'Por favor paga antes del',
    copied: 'Copiado',
    reported: 'Ya pagué · mandar captura',
    reportHow: '¿Cómo pagaste?',
    reportPhoto: 'Captura de tu pago',
    reportPick: 'Elegir captura',
    reportSend: 'Mandar',
    reportSending: 'Mandando…',
    reportNeed: 'Elige cómo pagaste y agrega la captura.',
    reportError: 'No se mandó. Intenta otra vez o escríbenos.',
    cancel: 'Cancelar',
    tracking: 'Rastreo',
    track: 'Rastrear mi paquete',
    packagePhoto: 'Tu paquete',
    account: 'Ver mis pedidos y envíos',
    accountSub: 'Tu cuenta completa',
    empty: 'Nada por aquí todavía.',
    loadError: 'No pudimos cargar tu canasta. Intenta otra vez.',
    lang: 'EN',
    langLabel: 'Switch to English',
    other: 'Otro',
  },
} as const;

type Locale = 'en' | 'es';

/** $100, $99.50 — no ".00" on round totals, like the mockup. */
function money(cents: number | null | undefined, locale: Locale) {
  const v = Number(cents || 0) / 100;
  const round = Math.round(v * 100) % 100 === 0;
  return new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: round ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function trackUrl(num: string) {
  const base = process.env.NEXT_PUBLIC_TRACK_URL ?? 'https://track.erendirasboutique.com';
  return `${base.replace(/\/+$/, '')}/?tracking=${encodeURIComponent(num)}`;
}

function accountUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? 'https://my.erendirasboutique.com/account';
  return `${base.replace(/\/+$/, '')}?t=${encodeURIComponent(token)}`;
}

/**
 * The sale's how-to-pay text, split into tiles. Lines like "Zelle: 555…"
 * or "Cash App - $erendiras" become a tile each; anything else is shown
 * as plain text under them, so nothing typed on the sale is ever lost.
 */
const WAYS: [RegExp, string][] = [
  [/^zelle/i, 'Zelle'],
  [/^cash\s*app/i, 'Cash App'],
  [/^venmo/i, 'Venmo'],
  [/^pay\s*pal/i, 'PayPal'],
  [/^apple\s*pay/i, 'Apple Pay'],
];

function parseWays(text: string | null) {
  const tiles: { label: string; value: string }[] = [];
  const rest: string[] = [];
  String(text || '')
    .split(/\r?\n/)
    .forEach((raw) => {
      const line = raw.trim().replace(/^[-•*·]\s*/, '');
      if (!line) return;
      const m = line.match(/^([^:：]{2,24}?)\s*(?:[:：]|\s[-–—]\s)\s*(.+)$/);
      if (m) {
        const hit = WAYS.find(([re]) => re.test(m[1].trim()));
        if (hit) {
          tiles.push({ label: hit[1], value: m[2].trim() });
          return;
        }
      }
      rest.push(line);
    });
  return { tiles, rest };
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

// Unpaid first (what she has to act on), then still-forming, then paid
// and shipped. Newest first inside each group (the API already sorts so).
const ORDER: Record<string, number> = { finalized: 0, open: 1, paid: 2, shipped: 3, released: 4 };

export default function PortalBaskets({ token, locale: forced }: { token: string; locale?: Locale }) {
  const [locale, setLocale] = useState<Locale>(forced ?? 'es');
  const [baskets, setBaskets] = useState<PortalBasket[] | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState(false);

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payErr, setPayErr] = useState<{ id: string; msg: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // "Ya pagué": she reports a Zelle / Venmo / Cash App... payment with a
  // screenshot. The basket shows as paid; Saturday's scan shows it as
  // "por confirmar" until someone checks the app.
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportMethod, setReportMethod] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportErr, setReportErr] = useState<string | null>(null);

  const t = copy[locale];

  // Spanish by default. ?lang=en (or the EN button) switches it.
  useEffect(() => {
    if (forced) return;
    try {
      if (new URL(window.location.href).searchParams.get('lang') === 'en') setLocale('en');
    } catch {
      // stays es
    }
  }, [forced]);

  function toggleLang() {
    const next: Locale = locale === 'es' ? 'en' : 'es';
    setLocale(next);
    try {
      const url = new URL(window.location.href);
      if (next === 'en') url.searchParams.set('lang', 'en');
      else url.searchParams.delete('lang');
      window.history.replaceState(null, '', url.toString());
    } catch {
      // the switch still works for this visit
    }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/portal/${token}/baskets`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        setLoadErr(true);
        return;
      }
      setBaskets(json.baskets ?? []);
      setFirstName(json.first_name ?? null);
      setLoadErr(false);
    } catch {
      // Offline or a dropped connection: keep what's on screen.
    }
  }, [token]);

  // Keep it current: poll every 20s while the tab is visible, refetch the
  // moment she comes back to it.
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
      } else stop();
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

  async function startCheckout(basketId: string) {
    setPayingId(basketId);
    setPayErr(null);
    try {
      const res = await fetch(`/api/live/portal/${token}/baskets/${basketId}/pay`, { method: 'POST', cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      setPayErr({ id: basketId, msg: json.error ?? t.payError });
    } catch {
      setPayErr({ id: basketId, msg: t.payError });
    }
    setPayingId(null);
  }

  async function sendReport(basketId: string) {
    if (!reportMethod || !reportFile) {
      setReportErr(t.reportNeed);
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
      setReportErr(t.reportError);
    }
    setReportBusy(false);
  }

  async function copyWay(key: string, value: string) {
    if (await copyToClipboard(value)) {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600);
    }
  }

  const list = (baskets || [])
    .map((b, i) => ({ b, i }))
    .sort((x, y) => (ORDER[x.b.status] ?? 9) - (ORDER[y.b.status] ?? 9) || x.i - y.i)
    .map((x) => x.b);

  function pill(status: string) {
    if (status === 'finalized') return { text: t.waiting, tone: 'due' };
    if (status === 'open') return { text: t.forming, tone: 'soft' };
    if (status === 'shipped') return { text: t.shipped, tone: 'good' };
    if (status === 'released') return { text: t.released, tone: 'soft' };
    return { text: t.paid, tone: 'good' };
  }

  return (
    <div className="mb">
      <header className="mb-head">
        <img className="mb-logo" src={BRAND_LOGO} alt="Erendira's Boutique" />
        {!forced && (
          <button type="button" className="mb-lang" aria-label={t.langLabel} onClick={toggleLang}>
            {t.lang}
          </button>
        )}
      </header>

      <div className="mb-hello">
        {firstName && <p className="mb-hi">{t.hello}, {firstName}</p>}
        <h1 className="mb-h1">{list.length > 1 ? t.headingMany : t.heading}</h1>
      </div>

      {loadErr && <p className="mb-card mb-muted">{t.loadError}</p>}
      {!loadErr && baskets === null && <div className="mb-card mb-skel" aria-busy="true" />}
      {!loadErr && baskets && baskets.length === 0 && <p className="mb-card mb-muted">{t.empty}</p>}

      {list.map((b) => {
        const due = b.status === 'finalized';
        const done = b.status === 'paid' || b.status === 'shipped';
        const total = Number(b.total_cents || 0);
        const p = pill(b.status);
        const tag = `#${b.basket_number}`;
        const instructions = locale === 'es' && b.payment_instructions_es ? b.payment_instructions_es : b.payment_instructions;
        const ways = parseWays(instructions);
        const withShip = (b.shipping_cents ?? 0) > 0 || b.items.length === 0;

        return (
          <div key={b.id} className="mb-basket">
            {/* Her basket: the photo she got on Messenger, number, total. */}
            <section className="mb-card mb-card--photo">
              <div className="mb-photo" role="img" aria-label={t.photoAlt}>
                {b.photo_url ? <img src={b.photo_url} alt="" /> : <span className="mb-photo__none" />}
                <span className="mb-num">{tag}</span>
              </div>
              {total > 0 && (
                <div className="mb-total">
                  <span className="mb-muted">{withShip ? t.totalShip : t.total}</span>
                  <span className="mb-total__n">{money(total, locale)}</span>
                </div>
              )}
              <span className={`mb-pill mb-pill--${p.tone}`}>
                <span className="mb-dot" aria-hidden="true" />
                {p.text}
              </span>

              {b.items.length > 0 && (
                <details className="mb-items">
                  <summary>{t.details}</summary>
                  <ul>
                    {b.items.map((i) => (
                      <li key={i.id}>
                        <span>
                          {locale === 'es' && i.description_es ? i.description_es : i.description}
                          {i.quantity > 1 ? ` ×${i.quantity}` : ''}
                        </span>
                        <span>{money((i.unit_price_cents ?? 0) * i.quantity, locale)}</span>
                      </li>
                    ))}
                    {(b.shipping_cents ?? 0) > 0 && (
                      <li className="mb-items__sum">
                        <span>{t.shipping}</span>
                        <span>{money(b.shipping_cents, locale)}</span>
                      </li>
                    )}
                    {(b.discount_cents ?? 0) > 0 && (
                      <li className="mb-items__sum">
                        <span>{t.discount}</span>
                        <span>−{money(b.discount_cents, locale)}</span>
                      </li>
                    )}
                  </ul>
                </details>
              )}
            </section>

            {/* Pay today or in 4 — Stripe checkout. */}
            {due && total > 0 && (
              <section className="mb-pay" aria-labelledby={`pay-${b.id}`}>
                <div className="mb-pay__top">
                  <h2 id={`pay-${b.id}`} className="mb-h2 mb-h2--pay">{t.payTitle}</h2>
                  {total >= 4000 ? (
                    <p className="mb-pay__from">
                      {t.payFrom} <span className="mb-pay__per">{money(Math.ceil(total / 4), locale)}</span> {t.payEvery}
                    </p>
                  ) : (
                    <p className="mb-pay__from">{t.payPlain}</p>
                  )}
                </div>
                <ul className="mb-bnpl" aria-label="Klarna, Afterpay, Zip, Affirm">
                  <li>Klarna</li>
                  <li>Afterpay</li>
                  <li>Zip</li>
                  <li>Affirm</li>
                </ul>
                <button type="button" className="mb-paybtn" disabled={payingId === b.id} onClick={() => startCheckout(b.id)}>
                  {payingId === b.id ? t.payOpening : `${t.payNow} ${money(total, locale)}`}
                </button>
                {payErr && payErr.id === b.id && <p className="mb-pay__err" role="alert">{payErr.msg}</p>}
                <p className="mb-secure">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
                  {t.paySecure}
                </p>
              </section>
            )}

            {/* Zelle, Cash App, Venmo, PayPal… and "Ya pagué". */}
            {due && (
              <section className="mb-card mb-card--pad" aria-labelledby={`otros-${b.id}`}>
                <h2 id={`otros-${b.id}`} className="mb-h2">{t.otherWays}</h2>
                {ways.tiles.length > 0 && (
                  <div className="mb-ways">
                    {ways.tiles.map((w, k) => {
                      const key = `${b.id}-${k}`;
                      return (
                        <button key={key} type="button" className="mb-way" onClick={() => copyWay(key, w.value)}>
                          <span className="mb-way__l">{copiedKey === key ? t.copied : w.label}</span>
                          <span className="mb-way__v">{w.value}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {ways.rest.length > 0 && <p className="mb-inst">{ways.rest.join('\n')}</p>}
                {!instructions && <p className="mb-inst">{t.noInstructions}</p>}
                <p className="mb-note">
                  {t.otherNote.split('{n}')[0]}
                  <span className="mb-ink">{tag}</span>
                  {t.otherNote.split('{n}')[1]}
                </p>
                {b.due_at && (
                  <p className="mb-note">
                    {t.dueBy}{' '}
                    {new Date(b.due_at).toLocaleString(locale === 'es' ? 'es-US' : 'en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })}
                  </p>
                )}

                {reportId !== b.id ? (
                  <button type="button" className="mb-ghost" onClick={() => { setReportId(b.id); setReportErr(null); }}>
                    {t.reported}
                  </button>
                ) : (
                  <div className="mb-report">
                    <p className="mb-label">{t.reportHow}</p>
                    <div className="mb-methods" role="radiogroup" aria-label={t.reportHow}>
                      {[
                        ['zelle', 'Zelle'],
                        ['cash_app', 'Cash App'],
                        ['venmo', 'Venmo'],
                        ['paypal', 'PayPal'],
                        ['apple_pay', 'Apple Pay'],
                        ['other', t.other],
                      ].map(([v, label]) => (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={reportMethod === v}
                          className={'mb-method' + (reportMethod === v ? ' mb-method--on' : '')}
                          onClick={() => setReportMethod(v)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="mb-label" htmlFor={`proof-${b.id}`}>{t.reportPhoto}</label>
                    <label className="mb-file">
                      <input
                        id={`proof-${b.id}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => setReportFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                      />
                      <span>{reportFile ? reportFile.name : t.reportPick}</span>
                    </label>
                    {reportErr && <p className="mb-pay__err mb-pay__err--ink" role="alert">{reportErr}</p>}
                    <button type="button" className="mb-solid" disabled={reportBusy} onClick={() => sendReport(b.id)}>
                      {reportBusy ? t.reportSending : t.reportSend}
                    </button>
                    <button type="button" className="mb-link" onClick={() => setReportId(null)}>{t.cancel}</button>
                  </div>
                )}
              </section>
            )}

            {/* After it ships: the box photo and tracking. */}
            {done && (b.package_photo_url || b.tracking_number) && (
              <section className="mb-card mb-card--pad">
                {b.package_photo_url && (
                  <>
                    <h2 className="mb-h2">{t.packagePhoto}</h2>
                    <a href={b.package_photo_url} target="_blank" rel="noreferrer" className="mb-pkg">
                      <img src={b.package_photo_url} alt={t.packagePhoto} loading="lazy" />
                    </a>
                  </>
                )}
                {b.tracking_number && (
                  <>
                    <div className="mb-total mb-total--track">
                      <span className="mb-muted">{t.tracking}</span>
                      <span className="mb-trackno">{b.carrier ? `${b.carrier} · ` : ''}{b.tracking_number}</span>
                    </div>
                    <a className="mb-ghost" href={b.tracking_url || trackUrl(b.tracking_number)} target="_blank" rel="noreferrer">
                      {t.track}
                    </a>
                  </>
                )}
              </section>
            )}
          </div>
        );
      })}

      <a className="mb-card mb-account" href={accountUrl(token)}>
        <span className="mb-account__t">
          <span>{t.account}</span>
          <span className="mb-muted mb-small">{t.accountSub}</span>
        </span>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </a>
    </div>
  );
}
