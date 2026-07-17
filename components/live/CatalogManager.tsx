'use client';

import { useMemo, useRef, useState } from 'react';
import type { LiveItemWithStock } from '@/types/live';
import { centsToDisplay, normalizeCode, parsePriceToCents } from '@/lib/live/money';

export default function CatalogManager({
  saleId,
  initialItems,
}: {
  saleId: string;
  initialItems: LiveItemWithStock[];
}) {
  const [items, setItems] = useState(initialItems);
  const [mode, setMode] = useState<'one' | 'paste'>('one');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionEs, setDescriptionEs] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [photoUrl, setPhotoUrl] = useState('');
  const [paste, setPaste] = useState('');

  /**
   * Re-read the rack from the API rather than router.refresh().
   *
   * router.refresh() re-runs the server component, but the fresh props it
   * returns can't overwrite useState — and worse, the Router Cache may
   * hand back a stale payload. That's what made items appear and then
   * disappear a few seconds later. Reading the API directly with
   * no-store is the only version that's always true.
   */
  async function reload() {
    try {
      const res = await fetch(`/api/live/sales/${saleId}/items`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setItems(json.items ?? []);
    } catch {
      // Keep what's on screen — it came from a successful write.
    }
  }

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0),
    [items]
  );

  async function addItems(rows: unknown[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/live/sales/${saleId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: rows }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not add those items.');
        return false;
      }
      setItems((prev) => [
        ...prev,
        ...json.items.map((i: any) => ({ ...i, quantity_claimed: 0, quantity_remaining: i.quantity })),
      ]);
      await reload();
      return true;
    } catch {
      setError('Network trouble — nothing was added.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addOne() {
    const priceCents = parsePriceToCents(price);
    if (!code.trim()) return setError('Every item needs a tag code.');
    if (!description.trim()) return setError('Every item needs a description.');
    if (priceCents === null) return setError('Price needs to be a dollar amount, like 24 or 24.50.');

    const ok = await addItems([
      {
        code: normalizeCode(code),
        description: description.trim(),
        description_es: descriptionEs.trim() || null,
        price_cents: priceCents,
        quantity: Math.max(1, Number(quantity) || 1),
        photo_url: photoUrl.trim() || null,
        sort_order: items.length,
      },
    ]);

    if (ok) {
      setCode('');
      setDescription('');
      setDescriptionEs('');
      setPrice('');
      setQuantity('1');
      setPhotoUrl('');
      codeRef.current?.focus();
    }
  }

  /** Paste from a sheet: code, description, price, qty, photo url */
  async function addPasted() {
    const rows = paste
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const cols = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) =>
          c.trim().replace(/^"|"$/g, '')
        );
        const priceCents = parsePriceToCents(cols[2] ?? '');
        return {
          code: normalizeCode(cols[0] ?? ''),
          description: cols[1] ?? '',
          price_cents: priceCents ?? -1,
          quantity: Number(cols[3]) > 0 ? Number(cols[3]) : 1,
          photo_url: cols[4] || null,
          sort_order: items.length + index,
        };
      });

    const bad = rows.findIndex((r) => !r.code || !r.description || r.price_cents < 0);
    if (bad >= 0) {
      setError(`Line ${bad + 1} needs a code, a description, and a price.`);
      return;
    }

    const ok = await addItems(rows);
    if (ok) setPaste('');
  }

  async function removeItem(id: string) {
    const res = await fetch(`/api/live/items/${id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Could not remove that item.');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    await reload();
  }

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <section className="live__card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <h2>Load the rack</h2>
          <div className="live__nav">
            <button
              className={`live__tab${mode === 'one' ? ' live__tab--on' : ''}`}
              onClick={() => setMode('one')}
            >
              One at a time
            </button>
            <button
              className={`live__tab${mode === 'paste' ? ' live__tab--on' : ''}`}
              onClick={() => setMode('paste')}
            >
              Paste a list
            </button>
          </div>
        </div>

        {mode === 'one' ? (
          <>
            <div className="live__grid">
              <div>
                <label className="live__label" htmlFor="cat-code">
                  Tag code
                </label>
                <input
                  id="cat-code"
                  ref={codeRef}
                  className="live__input live__mono"
                  placeholder="A3"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div>
                <label className="live__label" htmlFor="cat-desc">
                  Description
                </label>
                <input
                  id="cat-desc"
                  className="live__input"
                  placeholder="Ivory linen blouse, M"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="live__label" htmlFor="cat-desc-es">
                  Descripción (ES)
                </label>
                <input
                  id="cat-desc-es"
                  className="live__input"
                  placeholder="Blusa de lino marfil, M"
                  value={descriptionEs}
                  onChange={(e) => setDescriptionEs(e.target.value)}
                />
              </div>
              <div>
                <label className="live__label" htmlFor="cat-price">
                  Price
                </label>
                <input
                  id="cat-price"
                  className="live__input live__mono"
                  inputMode="decimal"
                  placeholder="24.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="live__label" htmlFor="cat-qty">
                  How many
                </label>
                <input
                  id="cat-qty"
                  className="live__input live__mono"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div>
                <label className="live__label" htmlFor="cat-photo">
                  Photo URL
                </label>
                <input
                  id="cat-photo"
                  className="live__input"
                  placeholder="https://…"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <button className="live__btn" onClick={addOne} disabled={busy}>
                {busy ? 'Adding…' : 'Add item'}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="live__label" htmlFor="cat-paste">
              One item per line — code, description, price, how many, photo URL
            </label>
            <textarea
              id="cat-paste"
              className="live__textarea live__mono"
              rows={8}
              placeholder={'A1, Ivory linen blouse M, 24, 1\nA2, Sand wrap skirt S, 32, 2'}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
            />
            <div style={{ marginTop: 16 }}>
              <button className="live__btn" onClick={addPasted} disabled={busy || !paste.trim()}>
                {busy ? 'Adding…' : 'Add all'}
              </button>
            </div>
          </>
        )}

        {error && (
          <p style={{ color: 'var(--alert)', marginTop: 14, fontSize: '0.875rem' }}>{error}</p>
        )}
      </section>

      <section>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 14,
          }}
        >
          <h2>
            On the rack{' '}
            <span className="live__mono live__muted" style={{ fontSize: '1rem' }}>
              {items.length}
            </span>
          </h2>
          <span className="live__mono live__muted" style={{ fontSize: '0.875rem' }}>
            {centsToDisplay(total)} at full price
          </span>
        </div>

        {items.length === 0 ? (
          <div className="live__empty">
            <h3>Nothing loaded yet</h3>
            <p className="live__muted" style={{ marginTop: 8 }}>
              Add the rack now and the live becomes basket number plus tag code — nothing else to
              type.
            </p>
          </div>
        ) : (
          <div className="live__grid">
            {items.map((item) => (
              <article key={item.id} className="live__item">
                {item.photo_url ? (
                  <img
                    className="live__itemPhoto"
                    src={item.photo_url}
                    alt={item.description}
                    loading="lazy"
                  />
                ) : (
                  <div className="live__itemPhoto live__itemPhoto--empty">No photo</div>
                )}

                <div className="live__itemBody">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span className="live__tag">{item.code}</span>
                    <span className="live__mono">{centsToDisplay(item.price_cents)}</span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.35 }}>
                    {item.description}
                  </p>
                  {item.description_es && (
                    <p className="live__muted" style={{ margin: 0, fontSize: '0.8125rem' }}>
                      {item.description_es}
                    </p>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 4,
                    }}
                  >
                    <span
                      className={`live__stock${item.quantity_remaining <= 0 ? ' live__stock--out' : ''}`}
                    >
                      {item.quantity_remaining} of {item.quantity} left
                    </span>
                    {item.quantity_claimed === 0 && (
                      <button className="live__undo" onClick={() => removeItem(item.id)}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
