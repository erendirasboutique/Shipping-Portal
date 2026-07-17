'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * For the occasional customer who wants to pay by card.
 *
 * This module doesn't talk to Stripe at all — you already have a payment
 * link generator in the billing portal, so make the link there and paste
 * it here. The customer's portal then shows a "Pay by card" button.
 *
 * Pasting a link doesn't mark anything paid. When the money shows up in
 * Stripe you mark it paid like any other method.
 */
export default function CardLinkMenu({
  basketNumber,
  currentUrl,
  onSave,
  disabled,
}: {
  basketNumber: number;
  currentUrl: string | null;
  onSave: (url: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(currentUrl ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', onClickAway);
      document.addEventListener('keydown', onEsc);
    }
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  function save() {
    const trimmed = url.trim();

    if (!trimmed) {
      onSave(null);
      setOpen(false);
      setProblem(null);
      return;
    }

    if (!/^https:\/\//i.test(trimmed)) {
      setProblem('That needs to be a full https:// link.');
      return;
    }

    onSave(trimmed);
    setOpen(false);
    setProblem(null);
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="live__undo"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="Paste a Stripe link for a customer paying by card"
        style={currentUrl ? { borderColor: 'var(--taupe)', color: 'var(--ink)' } : undefined}
      >
        {currentUrl ? 'Card link ✓' : 'Card link'}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 30,
            top: 'calc(100% + 6px)',
            right: 0,
            width: 280,
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 3,
            boxShadow: '0 10px 30px rgba(61, 52, 40, 0.16)',
            padding: 14,
            textAlign: 'left',
          }}
        >
          <p className="live__eyebrow" style={{ marginBottom: 6 }}>
            Basket {basketNumber} — card link
          </p>
          <p className="live__muted" style={{ fontSize: '0.75rem', margin: '0 0 10px' }}>
            Make it in the billing portal, paste it here. Leave empty to remove.
          </p>

          <input
            className="live__input"
            style={{ padding: '7px 9px', fontSize: '0.8125rem' }}
            placeholder="https://buy.stripe.com/…"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setProblem(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
            }}
          />

          {problem && (
            <p style={{ color: 'var(--alert)', fontSize: '0.75rem', margin: '8px 0 0' }}>
              {problem}
            </p>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <button className="live__btn" style={{ flex: 1, padding: '8px 10px' }} onClick={save}>
              Save
            </button>
            <button
              className="live__btn live__btn--ghost"
              style={{ padding: '8px 10px' }}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
