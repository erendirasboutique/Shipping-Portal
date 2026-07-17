'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parsePriceToCents } from '@/lib/live/money';

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

export default function NewSaleForm() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [open, setOpen] = useState(false);
  const [saleDate, setSaleDate] = useState(today);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState(defaultDueDate(today));
  const [shipping, setShipping] = useState('0');
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
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not start the sale.');
        return;
      }

      router.push(`/admin/live/${json.sale.id}/catalog`);
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
          Start a sale
        </button>
      </div>
    );
  }

  return (
    <section className="live__card">
      <h2 style={{ marginBottom: 18 }}>Start a sale</h2>

      <div className="live__grid">
        <div>
          <label className="live__label" htmlFor="sale-date">
            Live date
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
            Name (optional)
          </label>
          <input
            id="sale-title"
            className="live__input"
            placeholder="Wednesday night rack"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="live__label" htmlFor="sale-due">
            Pay by
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
            Default shipping
          </label>
          <input
            id="sale-ship"
            className="live__input"
            inputMode="decimal"
            value={shipping}
            onChange={(e) => setShipping(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p style={{ color: 'var(--alert)', marginTop: 14, fontSize: '0.875rem' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="live__btn" onClick={create} disabled={busy}>
          {busy ? 'Starting…' : 'Start sale'}
        </button>
        <button
          className="live__btn live__btn--ghost"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
