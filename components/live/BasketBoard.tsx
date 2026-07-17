'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BasketDetail, LiveSale } from '@/types/live';
import { centsToDisplay, parsePriceToCents } from '@/lib/live/money';
import { basketMessage, dueLabel, type MessageLocale } from '@/lib/live/messages';
import { PAYMENT_METHODS, paymentMethodLabel } from '@/lib/live/schema';
import CustomerPicker from '@/components/live/CustomerPicker';
import MarkPaidMenu from '@/components/live/MarkPaidMenu';

export default function BasketBoard({
  sale,
  initialBaskets,
}: {
  sale: LiveSale;
  initialBaskets: BasketDetail[];
}) {
  const router = useRouter();
  const [baskets, setBaskets] = useState(initialBaskets);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [locale, setLocale] = useState<MessageLocale>('en');

  const stats = useMemo(() => {
    const live = baskets.filter((b) => b.status !== 'void' && b.status !== 'released');
    const paid = baskets.filter((b) => b.status === 'paid' || b.status === 'shipped');

    return {
      count: baskets.length,
      unmatched: baskets.filter((b) => !b.customer_id).length,
      awaiting: baskets.filter((b) => b.status === 'finalized').length,
      paid: paid.length,
      gross: live.reduce((sum, b) => sum + b.total_cents, 0),
      collected: paid.reduce((sum, b) => sum + b.total_cents, 0),
      byMethod: PAYMENT_METHODS.map((m) => {
        const rows = baskets.filter((b) => b.payment_method === m.value);
        return {
          ...m,
          count: rows.length,
          cents: rows.reduce((sum, b) => sum + b.total_cents, 0),
        };
      }).filter((m) => m.count > 0),
    };
  }, [baskets]);

  function replace(next: BasketDetail) {
    setBaskets((prev) => prev.map((b) => (b.id === next.id ? next : b)));
  }

  async function patch(basketId: string, body: Record<string, unknown>) {
    setBusyId(basketId);
    setError(null);
    try {
      const res = await fetch(`/api/live/baskets/${basketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'That change did not save.');
        return;
      }
      if (json.warning) setError(json.warning);
      replace(json.basket);
      router.refresh();
    } catch {
      setError('Network trouble — that change did not save.');
    } finally {
      setBusyId(null);
    }
  }

  async function finalize(basket: BasketDetail) {
    setBusyId(basket.id);
    setError(null);
    try {
      const res = await fetch(`/api/live/baskets/${basket.id}/finalize`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Basket ${basket.basket_number} could not be finalized.`);
        return;
      }
      replace(json.basket);
      router.refresh();
    } catch {
      setError('Network trouble — nothing was finalized.');
    } finally {
      setBusyId(null);
    }
  }

  async function finalizeAll() {
    const ready = baskets.filter(
      (b) => b.status === 'open' && b.customer_id && b.item_count > 0
    );
    for (const basket of ready) await finalize(basket);
  }

  async function copyMessage(basket: BasketDetail) {
    if (!basket.customer?.portal_token) {
      setError(`Basket ${basket.basket_number} has no portal link yet — match a customer first.`);
      return;
    }

    const text = basketMessage({
      locale,
      customerName: basket.customer.name,
      basketNumber: basket.basket_number,
      itemCount: basket.item_count,
      totalCents: basket.total_cents,
      portalToken: basket.customer.portal_token,
      dueLabel: dueLabel(sale.payment_due_at, locale),
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(basket.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setError('The browser blocked the clipboard. Select the text manually instead.');
    }
  }

  /**
   * Optional and per basket — only for the customers who ask to pay by
   * card. Nothing about this marks the basket paid; you still do that by
   * hand once the money shows up in Stripe.
   */
  async function makeCardLink(basket: BasketDetail) {
    setBusyId(basket.id);
    setError(null);
    try {
      if (basket.stripe_payment_link_url) {
        await navigator.clipboard.writeText(basket.stripe_payment_link_url);
        setCopiedId(basket.id);
        setTimeout(() => setCopiedId(null), 1800);
        return;
      }

      const res = await fetch(`/api/live/baskets/${basket.id}/payment-link`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not create a card link.');
        return;
      }

      await navigator.clipboard.writeText(json.url).catch(() => {});
      replace({ ...basket, stripe_payment_link_url: json.url });
      setCopiedId(basket.id);
      setTimeout(() => setCopiedId(null), 1800);
      router.refresh();
    } catch {
      setError('Network trouble — no link was created.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* ---- summary ---- */}
      <section className="live__card">
        <div
          style={{
            display: 'grid',
            gap: 18,
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          }}
        >
          <Stat label="Baskets" value={String(stats.count)} />
          <Stat label="Unmatched" value={String(stats.unmatched)} alert={stats.unmatched > 0} />
          <Stat label="Awaiting pay" value={String(stats.awaiting)} />
          <Stat label="Paid" value={String(stats.paid)} />
          <Stat label="Gross" value={centsToDisplay(stats.gross)} />
          <Stat label="Collected" value={centsToDisplay(stats.collected)} />
        </div>

        {stats.byMethod.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 18,
              flexWrap: 'wrap',
              marginTop: 18,
              paddingTop: 16,
              borderTop: '1px solid var(--line)',
            }}
          >
            {stats.byMethod.map((m) => (
              <span key={m.value} className="live__mono" style={{ fontSize: '0.8125rem' }}>
                <span className="live__muted">{m.label} </span>
                {centsToDisplay(m.cents)}
                <span className="live__muted"> ({m.count})</span>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
          <button className="live__btn" onClick={finalizeAll} disabled={busyId !== null}>
            Finalize every matched basket
          </button>

          <div className="live__nav" style={{ marginLeft: 'auto' }}>
            <button
              className={`live__tab${locale === 'en' ? ' live__tab--on' : ''}`}
              onClick={() => setLocale('en')}
            >
              EN message
            </button>
            <button
              className={`live__tab${locale === 'es' ? ' live__tab--on' : ''}`}
              onClick={() => setLocale('es')}
            >
              ES message
            </button>
          </div>
        </div>

        {error && (
          <p style={{ color: 'var(--alert)', marginTop: 14, fontSize: '0.875rem' }}>{error}</p>
        )}
      </section>

      {/* ---- baskets ---- */}
      {baskets.length === 0 ? (
        <div className="live__empty">
          <h3>No baskets yet</h3>
          <p className="live__muted" style={{ marginTop: 8 }}>
            Baskets appear here the moment the first claim lands during the live.
          </p>
        </div>
      ) : (
        <section className="live__card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="live__table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>#</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Ship</th>
                <th>Total</th>
                <th>Status</th>
                <th>Paid with</th>
                <th style={{ textAlign: 'right', paddingRight: 20 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {baskets.map((basket) => (
                <tr key={basket.id}>
                  <td className="live__mono" style={{ fontSize: '1.125rem', paddingLeft: 20 }}>
                    {basket.basket_number}
                  </td>

                  <td style={{ minWidth: 220 }}>
                    <CustomerPicker
                      value={basket.customer ?? null}
                      onSelect={(customer) =>
                        patch(basket.id, { customer_id: customer?.id ?? null })
                      }
                    />
                  </td>

                  <td className="live__mono">{basket.item_count}</td>

                  <td style={{ width: 96 }}>
                    <input
                      className="live__input live__mono"
                      style={{ padding: '6px 8px', fontSize: '0.875rem' }}
                      defaultValue={(basket.shipping_cents / 100).toFixed(2)}
                      onBlur={(e) => {
                        const cents = parsePriceToCents(e.target.value);
                        if (cents === null) {
                          e.target.value = (basket.shipping_cents / 100).toFixed(2);
                          setError('Shipping needs to be a dollar amount.');
                          return;
                        }
                        if (cents !== basket.shipping_cents) {
                          patch(basket.id, { shipping_cents: cents });
                        }
                      }}
                      aria-label={`Shipping for basket ${basket.basket_number}`}
                    />
                  </td>

                  <td className="live__mono" style={{ fontWeight: 600 }}>
                    {centsToDisplay(basket.total_cents)}
                  </td>

                  <td>
                    <span className={`live__pill live__pill--${basket.status}`}>
                      {basket.status}
                    </span>
                  </td>

                  <td>
                    {basket.payment_method ? (
                      <>
                        <div style={{ fontSize: '0.875rem' }}>
                          {paymentMethodLabel(basket.payment_method)}
                        </div>
                        {basket.payment_note && (
                          <div className="live__muted" style={{ fontSize: '0.75rem' }}>
                            {basket.payment_note}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="live__muted">—</span>
                    )}
                  </td>

                  <td style={{ paddingRight: 20 }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        justifyContent: 'flex-end',
                        flexWrap: 'wrap',
                      }}
                    >
                      {basket.status === 'open' && (
                        <button
                          className="live__undo"
                          onClick={() => finalize(basket)}
                          disabled={busyId === basket.id || !basket.customer_id}
                          title={
                            basket.customer_id
                              ? 'Lock the total so the portal can show it'
                              : 'Match a customer first'
                          }
                        >
                          Finalize
                        </button>
                      )}

                      {basket.customer?.portal_token && (
                        <button className="live__undo" onClick={() => copyMessage(basket)}>
                          {copiedId === basket.id ? 'Copied' : 'Copy message'}
                        </button>
                      )}

                      {basket.status === 'finalized' && (
                        <>
                          <MarkPaidMenu
                            basketNumber={basket.basket_number}
                            disabled={busyId === basket.id}
                            onConfirm={(method, note) =>
                              patch(basket.id, {
                                status: 'paid',
                                payment_method: method,
                                payment_note: note || null,
                              })
                            }
                          />
                          <button
                            className="live__undo"
                            onClick={() => makeCardLink(basket)}
                            disabled={busyId === basket.id}
                            title="Only for customers who want to pay by card"
                          >
                            {basket.stripe_payment_link_url ? 'Copy card link' : 'Card link'}
                          </button>
                          <button
                            className="live__undo"
                            onClick={() => patch(basket.id, { status: 'released' })}
                            title="Put the items back on the rack"
                          >
                            Release
                          </button>
                        </>
                      )}

                      {(basket.status === 'finalized' || basket.status === 'released') && (
                        <button
                          className="live__undo"
                          onClick={() => patch(basket.id, { status: 'open' })}
                          title="Unlock the total. Clears any payment record."
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <p className="live__eyebrow" style={{ marginBottom: 4 }}>
        {label}
      </p>
      <p
        className="live__mono"
        style={{
          margin: 0,
          fontSize: '1.5rem',
          color: alert ? 'var(--alert)' : 'var(--ink)',
        }}
      >
        {value}
      </p>
    </div>
  );
}
