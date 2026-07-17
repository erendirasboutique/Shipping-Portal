'use client';

import { useEffect, useState } from 'react';
import type { BasketDetail, CustomerRow, LiveSale } from '@/types/live';
import { centsToDisplay, parsePriceToCents } from '@/lib/live/money';
import { PAYMENT_METHODS, paymentMethodLabel } from '@/lib/live/schema';
import { basketMessage, dueLabel, portalUrl } from '@/lib/live/messages';
import { useLocale } from '@/lib/live/i18n';
import CustomerPicker from '@/components/live/CustomerPicker';

/**
 * Everything about one basket, in a panel.
 *
 * The old table put the customer picker in a cell inside a horizontally
 * scrolling row, which meant hunting sideways for your own search results.
 * A basket is one thing; it gets one surface.
 */
export default function BasketDrawer({
  basket,
  basketNumber,
  sale,
  busy,
  onClose,
  onPatch,
  onFinalize,
  onMarkPaid,
}: {
  basket: BasketDetail | null;
  basketNumber: number;
  sale: LiveSale;
  busy: boolean;
  onClose: () => void;
  onPatch: (body: Record<string, unknown>) => void;
  onFinalize: () => void;
  onMarkPaid: (method: string, note: string) => void;
}) {
  const { t, locale } = useLocale();
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [cardUrl, setCardUrl] = useState(basket?.stripe_payment_link_url ?? '');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setPayOpen(false);
    setMethod(null);
    setNote('');
    setCardUrl(basket?.stripe_payment_link_url ?? '');
  }, [basket?.id, basket?.stripe_payment_link_url]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  async function copy(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // clipboard blocked — nothing useful to say beyond the button not flipping
    }
  }

  const token = basket?.customer?.portal_token ?? null;

  return (
    <>
      <div className="drawer__scrim" onClick={onClose} aria-hidden="true" />

      <aside className="drawer" role="dialog" aria-label={`${t.basket} ${basketNumber}`}>
        <header className="drawer__head">
          <div>
            <p className="live__eyebrow">{t.basket}</p>
            <h2 className="drawer__no">{basketNumber}</h2>
          </div>
          <div className="drawer__headRight">
            {basket && (
              <span className={`live__pill live__pill--${basket.status}`}>{basket.status}</span>
            )}
            <button className="drawer__x" onClick={onClose} aria-label={t.closePanel}>
              ×
            </button>
          </div>
        </header>

        {!basket ? (
          <div className="drawer__body">
            <div className="live__empty">
              <p className="live__muted" style={{ margin: 0 }}>
                {t.basketEmpty}
              </p>
            </div>
          </div>
        ) : (
          <div className="drawer__body">
            {/* customer */}
            <section className="drawer__sec">
              <p className="live__label">{t.customer}</p>
              <CustomerPicker
                value={basket.customer ?? null}
                onSelect={(c: CustomerRow | null) => onPatch({ customer_id: c?.id ?? null })}
              />
            </section>

            {/* items */}
            <section className="drawer__sec">
              <p className="live__label">
                {t.items} <span className="live__mono">{basket.item_count}</span>
              </p>

              {basket.items.length === 0 ? (
                <p className="live__muted" style={{ fontSize: '0.875rem' }}>
                  {t.basketEmpty}
                </p>
              ) : (
                <ul className="drawer__items">
                  {basket.items.map((i) => (
                    <li key={i.id} className="drawer__item">
                      {i.photo_url ? (
                        <img src={i.photo_url} alt="" className="drawer__thumb" loading="lazy" />
                      ) : (
                        <span className="drawer__thumb drawer__thumb--none" />
                      )}
                      <span className="drawer__itemDesc">
                        {i.description}
                        {i.quantity > 1 && (
                          <span className="live__mono live__muted"> ×{i.quantity}</span>
                        )}
                      </span>
                      <span className="live__mono">
                        {centsToDisplay(i.unit_price_cents * i.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* money */}
            <section className="drawer__sec">
              <div className="drawer__line">
                <span className="live__muted">{t.subtotal}</span>
                <span className="live__mono">{centsToDisplay(basket.subtotal_cents)}</span>
              </div>

              <div className="drawer__line">
                <span className="live__muted">{t.shipping}</span>
                <input
                  className="live__input live__mono drawer__ship"
                  defaultValue={(basket.shipping_cents / 100).toFixed(2)}
                  inputMode="decimal"
                  aria-label={t.shipping}
                  onBlur={(e) => {
                    const cents = parsePriceToCents(e.target.value);
                    if (cents === null) {
                      e.target.value = (basket.shipping_cents / 100).toFixed(2);
                      return;
                    }
                    if (cents !== basket.shipping_cents) onPatch({ shipping_cents: cents });
                  }}
                />
              </div>

              <div className="drawer__line drawer__line--total">
                <span>{t.total}</span>
                <span className="live__mono">{centsToDisplay(basket.total_cents)}</span>
              </div>

              {basket.payment_method && (
                <div className="drawer__line">
                  <span className="live__muted">{t.paidWith}</span>
                  <span>
                    {paymentMethodLabel(basket.payment_method)}
                    {basket.payment_note && (
                      <span className="live__muted"> · {basket.payment_note}</span>
                    )}
                  </span>
                </div>
              )}
            </section>

            {/* actions */}
            <section className="drawer__sec drawer__actions">
              {basket.status === 'open' && (
                <button
                  className="live__btn"
                  onClick={onFinalize}
                  disabled={busy || !basket.customer_id || basket.item_count === 0}
                  title={basket.customer_id ? t.lockTotal : t.matchFirst}
                >
                  {t.finalize}
                </button>
              )}

              {token && (
                <>
                  <button
                    className="live__btn live__btn--ghost"
                    onClick={() =>
                      copy(
                        basketMessage({
                          locale,
                          customerName: basket.customer?.name ?? null,
                          basketNumber: basket.basket_number,
                          itemCount: basket.item_count,
                          totalCents: basket.total_cents,
                          portalToken: token,
                          dueLabel: dueLabel(sale.payment_due_at, locale),
                        }),
                        'msg'
                      )
                    }
                  >
                    {copied === 'msg' ? t.copied : t.copyMessage}
                  </button>

                  <button
                    className="live__btn live__btn--ghost"
                    onClick={() => copy(portalUrl(token), 'link')}
                  >
                    {copied === 'link' ? t.copied : t.portalLink}
                  </button>
                </>
              )}

              {basket.status === 'finalized' && !payOpen && (
                <button className="live__btn" onClick={() => setPayOpen(true)} disabled={busy}>
                  {t.markPaid}
                </button>
              )}

              {basket.status === 'finalized' && (
                <button
                  className="live__btn live__btn--ghost"
                  onClick={() => onPatch({ status: 'released' })}
                  disabled={busy}
                  title={t.releaseHint}
                >
                  {t.release}
                </button>
              )}

              {(basket.status === 'finalized' || basket.status === 'released') && (
                <button
                  className="live__btn live__btn--ghost"
                  onClick={() => onPatch({ status: 'open' })}
                  disabled={busy}
                  title={t.reopenHint}
                >
                  {t.reopen}
                </button>
              )}
            </section>

            {/* mark paid */}
            {payOpen && (
              <section className="drawer__sec drawer__pay">
                <p className="live__label">{t.howDidTheyPay}</p>

                <div className="drawer__methods">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.value}
                      className={`chip${method === m.value ? ' chip--on' : ''}`}
                      onClick={() => setMethod(m.value)}
                    >
                      {locale === 'es' ? m.label_es : m.label}
                    </button>
                  ))}
                </div>

                <label className="live__label" htmlFor="pay-note">
                  {t.reference}
                </label>
                <input
                  id="pay-note"
                  className="live__input"
                  placeholder={t.referencePlaceholder}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && method) onMarkPaid(method, note.trim());
                  }}
                />

                <div className="drawer__payRow">
                  <button
                    className="live__btn"
                    disabled={!method || busy}
                    onClick={() => method && onMarkPaid(method, note.trim())}
                  >
                    {method ? t.markPaid : t.pickOne}
                  </button>
                  <button className="live__btn live__btn--ghost" onClick={() => setPayOpen(false)}>
                    {t.cancel}
                  </button>
                </div>
              </section>
            )}

            {/* card link */}
            {basket.status === 'finalized' && (
              <section className="drawer__sec">
                <p className="live__label">{t.cardLink}</p>
                <p className="live__muted drawer__hint">{t.cardLinkHint}</p>
                <div className="drawer__payRow">
                  <input
                    className="live__input"
                    placeholder="https://buy.stripe.com/…"
                    value={cardUrl}
                    onChange={(e) => setCardUrl(e.target.value)}
                  />
                  <button
                    className="live__btn live__btn--ghost"
                    onClick={() => onPatch({ stripe_payment_link_url: cardUrl.trim() || null })}
                    disabled={busy}
                  >
                    {t.save}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
