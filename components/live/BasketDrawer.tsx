'use client';

import { useEffect, useState } from 'react';
import type { BasketDetail, CustomerRow, LiveSale } from '@/types/live';
import { centsToDisplay, parsePriceToCents } from '@/lib/live/money';
import { PAYMENT_METHODS, formatOrderNumber, paymentMethodLabel } from '@/lib/live/schema';
import { basketMessage, dueLabel, portalUrl } from '@/lib/live/messages';
import BasketTimeline from '@/components/live/BasketTimeline';
import { useLocale } from '@/lib/live/i18n';
import { getOperator } from '@/lib/live/operator';
import CustomerPicker from '@/components/live/CustomerPicker';
import PhotoDrop from '@/components/live/PhotoDrop';
import SendMenu from '@/components/live/SendMenu';
import PaymentProof from '@/components/live/PaymentProof';

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
  error,
  onClose,
  onPatch,
  onFinalize,
  onMarkPaid,
  onRemoveItem,
}: {
  basket: BasketDetail | null;
  basketNumber: number;
  sale: LiveSale;
  busy: boolean;
  /**
   * Errors are shown in here, not on the board behind it. The board's
   * banner sits under the drawer's scrim — a failure could report itself
   * perfectly and you'd never see a word of it.
   */
  error?: string | null;
  onClose: () => void;
  onPatch: (body: Record<string, unknown>) => void;
  onFinalize: () => void;
  onMarkPaid: (method: string, note: string) => void;
  onRemoveItem: (claimId: string) => void;
}) {
  const { t, locale } = useLocale();
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [cardUrl, setCardUrl] = useState(basket?.stripe_payment_link_url ?? '');
  const [notes, setNotes] = useState(basket?.notes ?? '');
  const [tracking, setTracking] = useState(basket?.tracking_number ?? '');
  const [carrier, setCarrier] = useState(basket?.carrier ?? '');
  const [copied, setCopied] = useState<string | null>(null);
  const [shortLink, setShortLink] = useState<string | null>(null);
  const [orderQuery, setOrderQuery] = useState('');
  const [orderResults, setOrderResults] = useState<any[]>([]);
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    setPayOpen(false);
    setMethod(null);
    setNote('');
    setCardUrl(basket?.stripe_payment_link_url ?? '');
    setNotes(basket?.notes ?? '');
    setTracking(basket?.tracking_number ?? '');
    setCarrier(basket?.carrier ?? '');
  }, [basket?.id, basket?.stripe_payment_link_url, basket?.tracking_number, basket?.carrier]);

  // Resolve the customer's short (dub) link once when the drawer opens, so
  // BOTH Copy and Send use it — otherwise Send builds the long uuid URL and
  // the two disagree. Falls back to null (callers use the long URL) if dub
  // is off or the fetch fails.
  useEffect(() => {
    const customerId = basket?.customer?.id;
    if (!customerId) {
      setShortLink(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/live/customers/${customerId}/portal-link`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (!cancelled) setShortLink(res.ok ? json.url ?? null : null);
      } catch {
        if (!cancelled) setShortLink(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [basket?.id, basket?.customer?.id]);

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

  // Search existing orders to attach this basket to one.
  useEffect(() => {
    const q = orderQuery.trim();
    if (q.length < 1) {
      setOrderResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/live/orders/search?q=${encodeURIComponent(q)}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (!cancelled) setOrderResults(json.orders ?? []);
      } catch {
        if (!cancelled) setOrderResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderQuery]);

  async function attachToOrder(orderId: string) {
    if (!basket) return;
    setAttaching(true);
    try {
      const res = await fetch('/api/live/link-basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basket_id: basket.id, order_id: orderId, by: getOperator() }),
      });
      if (res.ok) {
        setOrderQuery('');
        setOrderResults([]);
        // Re-read so the linked order (and its tracking) shows immediately.
        onPatch({});
      }
    } finally {
      setAttaching(false);
    }
  }

  /**
   * Copy the customer's portal link — shortened via dub and reused for
   * every future order. Asks the server for the short link (which stores
   * it the first time), and falls back to the long URL if dub is off or
   * the request fails, so Copy never leaves you empty-handed.
   */
  async function copyPortalLink() {
    if (!token) return;
    // shortLink is resolved on open; fall back to the long URL if it isn't
    // ready or dub is off.
    await copy(shortLink || portalUrl(token), 'link');
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
            {basket?.order?.order_number && (
              <span className="drawer__eb live__mono">
                {formatOrderNumber(basket.order.order_number)}
              </span>
            )}
            {basket && (
              <span className={`live__pill live__pill--${basket.status}`}>{basket.status}</span>
            )}
            <button className="drawer__x" onClick={onClose} aria-label={t.closePanel}>
              ×
            </button>
          </div>
        </header>

        {error && (
          <p className="drawer__error" role="alert">
            {error}
          </p>
        )}

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

            {/* photo of their actual basket */}
            <section className="drawer__sec">
              <p className="live__label">{t.basketPhoto}</p>
              <div className="drawer__photo">
                <PhotoDrop
                  value={basket.photo_url}
                  saleId={sale.id}
                  onChange={(url) => onPatch({ photo_url: url })}
                />
              </div>
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
                      <button
                        className="drawer__rm"
                        title={t.removeItem}
                        aria-label={`${t.removeItem} ${i.description}`}
                        disabled={busy}
                        onClick={() => {
                          // A confirm, because this is destructive and the
                          // drawer is a fast surface — it's easy to hit the
                          // wrong row when you're moving.
                          if (window.confirm(t.removeItemConfirm)) onRemoveItem(i.id);
                        }}
                      >
                        ×
                      </button>
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

            {/* customer-submitted payment proof — the screenshot they uploaded
                when they tapped "¿Ya pagaste?". Method + note already show in
                the money section above; this pulls the private image on demand. */}
            {(basket.status === 'paid' || basket.status === 'shipped') && (
              <section className="drawer__sec">
                <p className="live__label">
                  {locale === 'es' ? 'Comprobante de pago' : 'Payment proof'}
                </p>
                <PaymentProof basketId={basket.id} />
              </section>
            )}

            {/* notes — staff only */}
            <section className="drawer__sec">
              <p className="live__label">{t.notes}</p>
              <p className="live__muted drawer__hint">{t.notesHint}</p>

              <div className="drawer__tags">
                {[t.tagPickup, t.tagMerge, t.tagHold, t.tagPaidPartial].map((tag) => {
                  const on = notes.includes(tag);
                  return (
                    <button
                      key={tag}
                      className={`chip chip--sm${on ? ' chip--on' : ''}`}
                      disabled={busy}
                      onClick={() => {
                        // Toggle the tag in and out of the text rather than
                        // keeping a separate tags column. One field, and
                        // anything you type by hand sits alongside it.
                        const next = on
                          ? notes
                              .split('\n')
                              .filter((l) => l.trim() !== tag)
                              .join('\n')
                              .trim()
                          : [tag, notes].filter(Boolean).join('\n');
                        setNotes(next);
                        onPatch({ notes: next || null });
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <textarea
                className="live__textarea"
                rows={3}
                placeholder={t.notesPlaceholder}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  if ((basket.notes ?? '') !== notes) onPatch({ notes: notes.trim() || null });
                }}
              />
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

              {basket.customer && (
                <a
                  className="live__btn live__btn--ghost"
                  href={`/api/live/baskets/${basket.id}/label?tag=Pickup`}
                  target="_blank"
                  rel="noreferrer"
                  title={t.printLabelHint}
                >
                  {t.printPickup}
                </a>
              )}

              {token && (
                <>
                  <SendMenu
                    text={basketMessage({
                      locale,
                      customerName: basket.customer?.name ?? null,
                      basketNumber: basket.basket_number,
                      itemCount: basket.item_count,
                      totalCents: basket.total_cents,
                      portalToken: token,
                      overrideLink: shortLink,
                      dueLabel: dueLabel(sale.payment_due_at, locale),
                    })}
                    photoUrl={basket.photo_url}
                    disabled={busy}
                  />

                  <button
                    className="live__btn live__btn--ghost"
                    onClick={copyPortalLink}
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

            {/* attach to an existing order — when this basket isn't linked yet */}
            {!basket.order && (
              <section className="drawer__sec">
                <p className="live__label">{t.attachOrder}</p>
                <p className="live__muted drawer__hint">{t.attachOrderHint}</p>
                <input
                  className="live__input"
                  placeholder={t.attachOrderSearch}
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                />
                {orderResults.length > 0 && (
                  <div className="drawer__orderList">
                    {orderResults.map((o) => (
                      <button
                        key={o.id}
                        className="drawer__orderItem"
                        disabled={attaching}
                        onClick={() => attachToOrder(o.id)}
                      >
                        <span className="live__mono">
                          {o.order_number ? `EB-${o.order_number}` : '—'}
                        </span>
                        <span className="drawer__orderName">
                          {o.to_name}
                          {o.to_city ? ` · ${o.to_city}, ${o.to_state}` : ''}
                        </span>
                        {o.tracking_number && <span className="drawer__orderShipped">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* tracking — appears on their page the moment it saves */}
            {(basket.status === 'paid' || basket.status === 'shipped' || basket.tracking_number) && (
              <section className="drawer__sec">
                <p className="live__label">{t.tracking}</p>
                <p className="live__muted drawer__hint">
                  {basket.order?.tracking_number ? t.trackingFromLabel : t.trackingHint}
                </p>

                {basket.order?.tracking_number && (
                  <a
                    className="drawer__fromLabel live__mono drawer__trackLink"
                    href={
                      basket.order.tracking_url ||
                      `https://track.erendirasboutique.com/?tracking=${encodeURIComponent(
                        basket.order.tracking_number
                      )}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {basket.order.carrier ? `${basket.order.carrier} · ` : ''}
                    {basket.order.tracking_number} ↗
                  </a>
                )}
                <div className="drawer__track">
                  <input
                    className="live__input"
                    style={{ flex: '0 0 96px' }}
                    placeholder={t.carrier}
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                  />
                  <input
                    className="live__input live__mono"
                    placeholder={t.trackingNumber}
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onPatch({
                          tracking_number: tracking.trim() || null,
                          carrier: carrier.trim() || null,
                        });
                      }
                    }}
                  />
                  <button
                    className="live__btn live__btn--ghost"
                    disabled={busy}
                    onClick={() =>
                      onPatch({
                        tracking_number: tracking.trim() || null,
                        carrier: carrier.trim() || null,
                      })
                    }
                  >
                    {t.save}
                  </button>
                </div>
              </section>
            )}

            {/* who did what */}
            {(basket.created_by || basket.finalized_by || basket.paid_by) && (
              <section className="drawer__sec drawer__who">
                {basket.created_by && (
                  <span>
                    {t.created} {t.by} <b>{basket.created_by}</b>
                  </span>
                )}
                {basket.finalized_by && (
                  <span>
                    {t.finalized} {t.by} <b>{basket.finalized_by}</b>
                  </span>
                )}
                {basket.paid_by && (
                  <span>
                    {t.paidBy} {t.by} <b>{basket.paid_by}</b>
                  </span>
                )}
              </section>
            )}

            {/* timeline — history + staff notes */}
            <BasketTimeline basketId={basket.id} />

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
