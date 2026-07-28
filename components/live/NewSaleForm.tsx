'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parsePriceToCents } from '@/lib/live/money';
import { useLocale } from '@/lib/live/i18n';

/** Friday 11:59pm local, the default deadline for a Wed/Thu sale. */
function defaultDueDate(saleDate: string): string {
  const [y, m, d] = saleDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const daysUntilFriday = (5 - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + daysUntilFriday);
  date.setHours(23, 59, 0, 0);

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const PAY_PLACEHOLDER = 'Zelle: pay@erendirasboutique.com\nCash App: $erendiras\nVenmo: @erendiras-boutique';

export default function NewSaleForm({ onCreated }: { onCreated?: () => void }) {
  const { t } = useLocale();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [open, setOpen] = useState(false);
  const [saleDate, setSaleDate] = useState(today);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState(defaultDueDate(today));
  const [shipping, setShipping] = useState('0');
  const [quickMode, setQuickMode] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [instructionsEs, setInstructionsEs] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSaleDateChange(value: string) {
    setSaleDate(value);
    setDueAt(defaultDueDate(value));
  }

  async function create() {
    setError(null);

    const shippingCents = parsePriceToCents(shipping);
    if (shippingCents === null) {
      setError('Shipping needs to be a dollar amount, like 6 or 6.50.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/live/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_date: saleDate,
          title: title.trim() || null,
          payment_due_at: dueAt ? new Date(dueAt).toISOString() : null,
          default_shipping_cents: shippingCents,
          quick_mode: quickMode,
          payment_instructions: instructions.trim() || null,
          payment_instructions_es: instructionsEs.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not start the sale.');
        return;
      }

      // Refresh the list first, so the sale is visibly there even if the
      // navigation is slow or the person hits back.
      onCreated?.();
      setOpen(false);
      router.push(`/admin/live/${json.sale.id}/${quickMode ? 'baskets' : 'catalog'}`);
    } catch {
      setError('Network trouble — the sale was not created. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div>
        <button className="live__btn" onClick={() => setOpen(true)}>
          {t.startSale}
        </button>
      </div>
    );
  }

  return (
    <section className="live__card">
      <h2 style={{ marginBottom: 18 }}>{t.newSale}</h2>

      <div className="live__grid">
        <div>
          <label className="live__label" htmlFor="sale-date">
            {t.liveDate}
          </label>
          <input
            id="sale-date"
            className="live__input"
            type="date"
            value={saleDate}
            onChange={(e) => onSaleDateChange(e.target.value)}
          />
        </div>

        <div>
          <label className="live__label" htmlFor="sale-title">
            {t.saleName}
          </label>
          <input
            id="sale-title"
            className="live__input"
            placeholder={t.saleNamePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="live__label" htmlFor="sale-due">
            {t.payBy}
          </label>
          <input
            id="sale-due"
            className="live__input"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>

        <div>
          <label className="live__label" htmlFor="sale-ship">
            {t.defaultShipping}
          </label>
          <input
            id="sale-ship"
            className="live__input"
            inputMode="decimal"
            value={shipping}
            onChange={(e) => setShipping(e.target.value)}
            disabled={quickMode}
          />
        </div>
      </div>

      <label className="live__quickToggle" style={{ marginTop: 16 }}>
        <input
          type="checkbox"
          checked={quickMode}
          onChange={(e) => setQuickMode(e.target.checked)}
        />
        <span>
          <b>{t.quickMode}</b> — {quickMode ? t.quickModeOn : t.quickModeOff}
        </span>
      </label>

      <div style={{ marginTop: 18 }}>
        <label className="live__label" htmlFor="sale-pay-en">
          {t.howToPay}
        </label>
        <textarea
          id="sale-pay-en"
          className="live__textarea"
          rows={3}
          placeholder={PAY_PLACEHOLDER}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="live__label" htmlFor="sale-pay-es">
          {t.howToPayEs}
        </label>
        <textarea
          id="sale-pay-es"
          className="live__textarea"
          rows={3}
          placeholder={PAY_PLACEHOLDER}
          value={instructionsEs}
          onChange={(e) => setInstructionsEs(e.target.value)}
        />
      </div>

      {error && (
        <p style={{ color: 'var(--alert)', marginTop: 14, fontSize: '0.875rem' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="live__btn" onClick={create} disabled={busy}>
          {busy ? t.creating : t.createSale}
        </button>
        <button
          className="live__btn live__btn--ghost"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          {t.cancel}
        </button>
      </div>
    </section>
  );
}
