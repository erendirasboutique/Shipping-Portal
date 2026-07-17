'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LiveItemWithStock, RecentClaim } from '@/types/live';
import { centsToDisplay, normalizeCode } from '@/lib/live/money';
import { useLocale } from '@/lib/live/i18n';
import { withOperator, getOperator } from '@/lib/live/operator';

type Flash = { kind: 'ok' | 'err'; text: string } | null;

export default function ClaimEntry({
  saleId,
  catalog,
  initialClaims,
}: {
  saleId: string;
  catalog: LiveItemWithStock[];
  initialClaims: RecentClaim[];
}) {
  const { t } = useLocale();
  const [basketNumber, setBasketNumber] = useState('');
  const [code, setCode] = useState('');
  const [claims, setClaims] = useState<RecentClaim[]>(initialClaims);
  const [stock, setStock] = useState(
    () => new Map(catalog.map((i) => [i.id, i.quantity_remaining]))
  );
  const [flash, setFlash] = useState<Flash>(null);
  const [sending, setSending] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);

  const basketRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const byCode = useMemo(
    () => new Map(catalog.map((i) => [normalizeCode(i.code), i])),
    [catalog]
  );

  /** The preview under the code field, so a wrong tag is caught before Enter. */
  const preview = code.trim() ? byCode.get(normalizeCode(code)) ?? null : null;

  useEffect(() => {
    basketRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  const submit = useCallback(async () => {
    const n = Number(basketNumber);
    if (!Number.isInteger(n) || n < 1) {
      setFlash({ kind: 'err', text: 'Enter a basket number first.' });
      basketRef.current?.focus();
      return;
    }
    if (!code.trim()) {
      setFlash({ kind: 'err', text: 'Enter a tag code.' });
      codeRef.current?.focus();
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/live/sales/${saleId}/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withOperator({ basket_number: n, code: normalizeCode(code) })),
      });
      const json = await res.json();

      if (!res.ok) {
        setFlash({ kind: 'err', text: json.error ?? 'That claim did not save.' });
        codeRef.current?.select();
        return;
      }

      setClaims((prev) => [
        {
          id: json.claim.id,
          basket_number: n,
          code: json.item.code,
          description: json.item.description,
          unit_price_cents: json.claim.unit_price_cents,
          quantity: json.claim.quantity,
          created_at: json.claim.created_at,
        },
        ...prev.slice(0, 11),
      ]);

      if (json.stock) {
        setStock((prev) => new Map(prev).set(json.item.id, json.stock.quantity_remaining));
      }

      setFlash(
        json.oversold
          ? {
              kind: 'err',
              text: `Saved, but ${json.item.code} is now oversold. Check the rack.`,
            }
          : {
              kind: 'ok',
              text: `Basket ${n} · ${json.item.code} · ${centsToDisplay(
                json.basket.total_cents ?? 0
              )} ${t.running}`,
            }
      );

      // Keep the basket number — the same customer usually claims a run
      // of items back to back. Clearing it every time is the slow path.
      setCode('');
      codeRef.current?.focus();
    } catch {
      setFlash({ kind: 'err', text: 'Network trouble — that claim did not save.' });
    } finally {
      setSending(false);
    }
  }, [basketNumber, code, saleId]);

  async function undo(claimId: string) {
    const res = await fetch(
      `/api/live/claims/${claimId}?by=${encodeURIComponent(getOperator())}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setFlash({ kind: 'err', text: json.error ?? 'Could not undo that.' });
      return;
    }
    setClaims((prev) => prev.filter((c) => c.id !== claimId));
    setFlash({ kind: 'ok', text: 'Claim undone.' });
  }

  /** Ctrl/Cmd+Z undoes the most recent claim from anywhere on the page. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && claims[0]) {
        e.preventDefault();
        undo(claims[0].id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function pickFromGrid(item: LiveItemWithStock) {
    setCode(item.code);
    setGridOpen(false);
    if (basketNumber) submit();
    else basketRef.current?.focus();
  }

  return (
    <div className="live__stage">
      {/* ---- the rail: newest claim on top ---- */}
      <section>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 14,
          }}
        >
          <h2>{t.claims}</h2>
          <button className="live__tab" onClick={() => setGridOpen((v) => !v)}>
            {gridOpen ? t.hideRack : t.showRack}
          </button>
        </div>

        {gridOpen && (
          <div className="live__grid" style={{ marginBottom: 24 }}>
            {catalog.map((item) => {
              const left = stock.get(item.id) ?? item.quantity_remaining;
              return (
                <button
                  key={item.id}
                  className="live__item"
                  onClick={() => pickFromGrid(item)}
                  style={{ cursor: 'pointer', textAlign: 'left', padding: 0, border: '1px solid var(--line)' }}
                >
                  {item.photo_url ? (
                    <img className="live__itemPhoto" src={item.photo_url} alt="" loading="lazy" />
                  ) : (
                    <div className="rack__photo rack__photo--none">{t.noPhoto}</div>
                  )}
                  <div className="live__itemBody">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="live__tag">{item.code}</span>
                      <span className="live__mono">{centsToDisplay(item.price_cents)}</span>
                    </div>
                    <span className={`live__stock${left <= 0 ? ' live__stock--out' : ''}`}>
                      {left} {t.left}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {claims.length === 0 ? (
          <div className="live__empty">
            <h3>{t.nothingClaimed}</h3>
            <p className="live__muted" style={{ marginTop: 8 }}>
              {t.nothingClaimedHint}
            </p>
          </div>
        ) : (
          <div className="live__rail">
            {claims.map((claim) => (
              <div key={claim.id} className="live__claim">
                <span className="live__claimNo">{claim.basket_number}</span>
                <span className="live__claimDesc">
                  {claim.description}
                  {claim.code && <span className="live__claimCode"> · {claim.code}</span>}
                  {claim.quantity > 1 && (
                    <span className="live__claimCode"> · ×{claim.quantity}</span>
                  )}
                </span>
                <span className="live__claimPrice">
                  {centsToDisplay(claim.unit_price_cents * claim.quantity)}
                </span>
                <button className="live__undo" onClick={() => undo(claim.id)}>
                  {t.undo}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- the entry bar ---- */}
      <aside className="live__entry">
        <div className="live__entryRow">
          <div>
            <label className="live__entryLabel" htmlFor="claim-basket">
              {t.basket}
            </label>
            <input
              id="claim-basket"
              ref={basketRef}
              className="live__bigField"
              inputMode="numeric"
              autoComplete="off"
              placeholder="47"
              value={basketNumber}
              onChange={(e) => setBasketNumber(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  codeRef.current?.focus();
                }
              }}
            />
          </div>

          <div>
            <label className="live__entryLabel" htmlFor="claim-code">
              {t.tag}
            </label>
            <input
              id="claim-code"
              ref={codeRef}
              className="live__bigField"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="A3"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
                // A barcode scanner sends the code then Tab — treat it as Enter.
                if (e.key === 'Tab' && code.trim()) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </div>
        </div>

        {preview ? (
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              color: 'var(--sand)',
              fontSize: '0.875rem',
            }}
          >
            <span>{preview.description}</span>
            <span className="live__mono">{centsToDisplay(preview.price_cents)}</span>
          </div>
        ) : (
          <p className="live__hint">
            {t.claimHint}
          </p>
        )}

        <div style={{ marginTop: 18 }}>
          <button
            className="live__btn"
            style={{ width: '100%', background: 'var(--sand)', borderColor: 'var(--sand)', color: 'var(--ink)' }}
            onClick={submit}
            disabled={sending}
          >
            {sending ? t.saving : t.addToBasket}
          </button>
        </div>

        <button
          className="live__btn live__btn--ghost"
          style={{ width: '100%', marginTop: 8, color: 'var(--sand)', borderColor: 'rgba(245,243,239,0.22)' }}
          onClick={() => {
            setBasketNumber('');
            setCode('');
            basketRef.current?.focus();
          }}
        >
          {t.newBasket}
        </button>

        {flash && (
          <div className={`live__flash live__flash--${flash.kind}`} role="status">
            {flash.text}
          </div>
        )}

        <p className="live__hint" style={{ marginTop: 20 }}>
          {t.undoHint}
        </p>
      </aside>
    </div>
  );
}
