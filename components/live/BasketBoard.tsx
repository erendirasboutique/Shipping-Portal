'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BasketDetail, LiveSale } from '@/types/live';
import { centsToDisplay } from '@/lib/live/money';
import { PAYMENT_METHODS } from '@/lib/live/schema';
import { useLocale } from '@/lib/live/i18n';
import { withOperator, getOperator } from '@/lib/live/operator';
import BasketGrid from '@/components/live/BasketGrid';
import BasketDrawer from '@/components/live/BasketDrawer';

export default function BasketBoard({
  sale,
  initialBaskets,
}: {
  sale: LiveSale;
  initialBaskets: BasketDetail[];
}) {
  const { t } = useLocale();
  const [baskets, setBaskets] = useState<BasketDetail[]>(initialBaskets);
  const [openNumber, setOpenNumber] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jump, setJump] = useState('');

  /**
   * The client owns this list. router.refresh() can't update useState, and
   * Next 14's router cache will happily hand back a stale server render —
   * that combination is what made rows appear and then vanish. Reading the
   * API with no-store is the only version that's always true.
   */
  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/sales/${sale.id}/baskets?detail=1`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not load the baskets.');
        return;
      }
      if (Array.isArray(json.baskets)) setBaskets(json.baskets);
    } catch {
      // keep what's on screen
    }
  }, [sale.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const selected = useMemo(
    () => baskets.find((b) => b.basket_number === openNumber) ?? null,
    [baskets, openNumber]
  );

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
        return { ...m, count: rows.length, cents: rows.reduce((s, b) => s + b.total_cents, 0) };
      }).filter((m) => m.count > 0),
    };
  }, [baskets]);

  function replace(next: BasketDetail) {
    setBaskets((prev) => {
      const hit = prev.some((b) => b.id === next.id);
      return hit ? prev.map((b) => (b.id === next.id ? next : b)) : [...prev, next];
    });
  }

  async function patch(basketId: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/live/baskets/${basketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withOperator(body)),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'That change did not save.');
        return;
      }
      if (json.warning) setError(json.warning);
      replace(json.basket);
    } catch {
      setError('Network trouble — that change did not save.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Take an item out of a basket.
   *
   * Reuses the same soft-void the claims screen's Undo uses — the row
   * stays with voided_at and voided_by set. That matters more here than
   * there: on Thursday, when someone says "I never claimed that jacket",
   * you want to know it was there and who took it off.
   */
  async function removeItem(basketId: string, claimId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/live/claims/${claimId}?by=${encodeURIComponent(getOperator())}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? t.removeFailed);
        return;
      }

      // Re-read the basket rather than splicing it out of local state —
      // the totals are computed in the database, and guessing at them here
      // is how the number on screen stops matching the number they owe.
      const fresh = await fetch(`/api/live/baskets/${basketId}`, { cache: 'no-store' });
      const json = await fresh.json();
      if (fresh.ok && json.basket) replace(json.basket);
    } catch {
      setError(t.removeFailed);
    } finally {
      setBusy(false);
    }
  }

  async function finalize(basket: BasketDetail) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/live/baskets/${basket.id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ by: getOperator() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `${t.basket} ${basket.basket_number}: ${t.matchFirst}`);
        return;
      }
      replace(json.basket);
    } catch {
      setError('Network trouble — nothing was finalized.');
    } finally {
      setBusy(false);
    }
  }

  async function finalizeAll() {
    const ready = baskets.filter(
      (b) => b.status === 'open' && b.customer_id && b.item_count > 0
    );
    for (const b of ready) await finalize(b);
  }

  return (
    <div className="board">
      <section className="stats">
        <Stat label={t.baskets} value={String(stats.count)} />
        <Stat label={t.unmatched} value={String(stats.unmatched)} alert={stats.unmatched > 0} />
        <Stat label={t.awaitingPay} value={String(stats.awaiting)} />
        <Stat label={t.paid} value={String(stats.paid)} />
        <Stat label={t.gross} value={centsToDisplay(stats.gross)} />
        <Stat label={t.collected} value={centsToDisplay(stats.collected)} good />
      </section>

      {stats.byMethod.length > 0 && (
        <section className="methods">
          {stats.byMethod.map((m) => (
            <span key={m.value} className="methods__item">
              <span className="live__muted">{m.label}</span>{' '}
              <span className="live__mono">{centsToDisplay(m.cents)}</span>{' '}
              <span className="live__muted live__mono">({m.count})</span>
            </span>
          ))}
        </section>
      )}

      <section className="board__bar">
        <button className="live__btn" onClick={finalizeAll} disabled={busy}>
          {t.finalizeAll}
        </button>

        <div className="board__jump">
          <input
            className="live__input live__mono"
            inputMode="numeric"
            placeholder="#"
            value={jump}
            aria-label={t.jumpToBasket}
            onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && jump) {
                setOpenNumber(Number(jump));
                setJump('');
              }
            }}
          />
        </div>
      </section>

      {error && <p className="board__error">{error}</p>}

      {baskets.length === 0 ? (
        <div className="live__empty">
          <h3>{t.noBasketsYet}</h3>
          <p className="live__muted" style={{ marginTop: 8 }}>
            {t.noBasketsHint}
          </p>
        </div>
      ) : (
        <BasketGrid
          baskets={baskets}
          selectedId={selected?.id ?? null}
          onSelect={(n) => setOpenNumber(n)}
        />
      )}

      {openNumber !== null && (
        <BasketDrawer
          basket={selected}
          basketNumber={openNumber}
          sale={sale}
          busy={busy}
          error={error}
          onClose={() => {
            setOpenNumber(null);
            setError(null);
          }}
          onPatch={(body) => selected && patch(selected.id, body)}
          onFinalize={() => selected && finalize(selected)}
          onRemoveItem={(claimId) => selected && removeItem(selected.id, claimId)}
          onMarkPaid={(method, note) =>
            selected &&
            patch(selected.id, {
              status: 'paid',
              payment_method: method,
              payment_note: note || null,
            })
          }
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
  good,
}: {
  label: string;
  value: string;
  alert?: boolean;
  good?: boolean;
}) {
  return (
    <div className="stat">
      <p className="stat__label">{label}</p>
      <p className={`stat__value${alert ? ' stat__value--alert' : ''}${good ? ' stat__value--good' : ''}`}>
        {value}
      </p>
    </div>
  );
}
