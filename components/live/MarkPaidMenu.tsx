'use client';

import { useEffect, useRef, useState } from 'react';
import { PAYMENT_METHODS } from '@/lib/live/schema';

/**
 * "Mark paid" is never one click, because one click can't say how they
 * paid — and three weeks later "how" is the only thing you'll want to
 * know. Pick a method, optionally jot a reference, done.
 */
export default function MarkPaidMenu({
  basketNumber,
  onConfirm,
  disabled,
}: {
  basketNumber: number;
  onConfirm: (method: string, note: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) close();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
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

  function close() {
    setOpen(false);
    setMethod(null);
    setNote('');
  }

  function confirm() {
    if (!method) return;
    onConfirm(method, note.trim());
    close();
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button className="live__undo" onClick={() => setOpen((v) => !v)} disabled={disabled}>
        Mark paid
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 30,
            top: 'calc(100% + 6px)',
            right: 0,
            width: 260,
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 3,
            boxShadow: '0 10px 30px rgba(61, 52, 40, 0.16)',
            padding: 14,
            textAlign: 'left',
          }}
        >
          <p className="live__eyebrow" style={{ marginBottom: 10 }}>
            Basket {basketNumber} — how did they pay?
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
              marginBottom: 12,
            }}
          >
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMethod(m.value)}
                className="live__undo"
                style={
                  method === m.value
                    ? {
                        background: 'var(--ink)',
                        color: 'var(--cream)',
                        borderColor: 'var(--ink)',
                      }
                    : undefined
                }
              >
                {m.label}
              </button>
            ))}
          </div>

          <label className="live__label" htmlFor={`note-${basketNumber}`}>
            Reference (optional)
          </label>
          <input
            id={`note-${basketNumber}`}
            className="live__input"
            style={{ padding: '7px 9px', fontSize: '0.8125rem' }}
            placeholder="Zelle conf #, paid at shop…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && method) confirm();
            }}
          />

          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <button
              className="live__btn"
              style={{ flex: 1, padding: '8px 10px' }}
              onClick={confirm}
              disabled={!method}
            >
              {method ? 'Mark paid' : 'Pick one'}
            </button>
            <button
              className="live__btn live__btn--ghost"
              style={{ padding: '8px 10px' }}
              onClick={close}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
