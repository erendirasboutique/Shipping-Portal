'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LiveItemWithStock } from '@/types/live';
import { centsToDisplay, normalizeCode, parsePriceToCents } from '@/lib/live/money';
import { useLocale } from '@/lib/live/i18n';
import PhotoDrop from '@/components/live/PhotoDrop';

export default function CatalogManager({
  saleId,
  initialItems,
}: {
  saleId: string;
  initialItems: LiveItemWithStock[];
}) {
  const { t } = useLocale();
  const [items, setItems] = useState<LiveItemWithStock[]>(initialItems);
  const [mode, setMode] = useState<'one' | 'paste'>('one');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement | null>(null);

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionEs, setDescriptionEs] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [paste, setPaste] = useState('');

  /**
   * The client owns this list.
   *
   * router.refresh() re-runs the server component, but the fresh props it
   * returns can't overwrite useState — and Next 14's router cache can hand
   * back a stale render on top of that. Together that's what made an item
   * show up and then quietly disappear a few seconds later. Reading the
   * API with no-store is the only version that's always true.
   */
  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/sales/${saleId}/items`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && Array.isArray(json.items)) setItems(json.items);
    } catch {
      // keep what's on screen — it came from a write that succeeded
    }
  }, [saleId]);

  useEffect(() => {
    reload();
  }, [reload]);

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
        photo_url: photoUrl,
        sort_order: items.length,
      },
    ]);

    if (ok) {
      setCode('');
      setDescription('');
      setDescriptionEs('');
      setPrice('');
      setQuantity('1');
      setPhotoUrl(null);
      codeRef.current?.focus();
    }
  }

  async function addPasted() {
    const rows = paste
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const cols = line
          .split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
          .map((c) => c.trim().replace(/^"|"$/g, ''));
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
    await reload();
  }

  return (
    <div className="cat">
      <section className="card">
        <div className="card__head">
          <h2>{t.loadTheRack}</h2>
          <div className="seg">
            <button
              className={`seg__btn${mode === 'one' ? ' seg__btn--on' : ''}`}
              onClick={() => setMode('one')}
            >
              {t.oneAtATime}
            </button>
            <button
              className={`seg__btn${mode === 'paste' ? ' seg__btn--on' : ''}`}
              onClick={() => setMode('paste')}
            >
              {t.pasteAList}
            </button>
          </div>
        </div>

        {mode === 'one' ? (
          <div className="cat__form">
            <div className="cat__photo">
              <label className="live__label">{t.photo}</label>
              <PhotoDrop value={photoUrl} saleId={saleId} onChange={setPhotoUrl} />
            </div>

            <div className="cat__fields">
              <div className="cat__row">
                <div className="cat__f">
                  <label className="live__label" htmlFor="cat-code">
                    {t.tagCode}
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

                <div className="cat__f">
                  <label className="live__label" htmlFor="cat-price">
                    {t.price}
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

                <div className="cat__f">
                  <label className="live__label" htmlFor="cat-qty">
                    {t.howMany}
                  </label>
                  <input
                    id="cat-qty"
                    className="live__input live__mono"
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
              </div>

              <div className="cat__f">
                <label className="live__label" htmlFor="cat-desc">
                  {t.description}
                </label>
                <input
                  id="cat-desc"
                  className="live__input"
                  placeholder="Ivory linen blouse, M"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addOne();
                  }}
                />
              </div>

              <div className="cat__f">
                <label className="live__label" htmlFor="cat-desc-es">
                  {t.descriptionEs}
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
                <button className="live__btn" onClick={addOne} disabled={busy}>
                  {busy ? t.adding : t.addItem}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <label className="live__label" htmlFor="cat-paste">
              {t.pasteHint}
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
                {busy ? t.adding : t.addAll}
              </button>
            </div>
          </>
        )}

        {error && <p className="card__error">{error}</p>}
      </section>

      <section>
        <div className="cat__rackHead">
          <h2>
            {t.onTheRack} <span className="live__mono live__muted">{items.length}</span>
          </h2>
          <span className="live__mono live__muted">
            {centsToDisplay(total)} {t.atFullPrice}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="live__empty">
            <h3>{t.nothingLoaded}</h3>
            <p className="live__muted" style={{ marginTop: 8 }}>
              {t.nothingLoadedHint}
            </p>
          </div>
        ) : (
          <div className="rack">
            {items.map((item) => (
              <article key={item.id} className="rack__item">
                {item.photo_url ? (
                  <img
                    className="rack__photo"
                    src={item.photo_url}
                    alt={item.description}
                    loading="lazy"
                  />
                ) : (
                  <div className="rack__photo rack__photo--none">{t.noPhoto}</div>
                )}

                <div className="rack__body">
                  <div className="rack__top">
                    <span className="tag">{item.code}</span>
                    <span className="live__mono">{centsToDisplay(item.price_cents)}</span>
                  </div>

                  <p className="rack__desc">{item.description}</p>
                  {item.description_es && <p className="rack__descEs">{item.description_es}</p>}

                  <div className="rack__foot">
                    <span
                      className={`stock${item.quantity_remaining <= 0 ? ' stock--out' : ''}`}
                    >
                      {item.quantity_remaining} {t.of} {item.quantity} {t.left}
                    </span>
                    {item.quantity_claimed === 0 && (
                      <button className="live__undo" onClick={() => removeItem(item.id)}>
                        {t.remove}
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
