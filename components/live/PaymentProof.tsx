'use client';

import { useState } from 'react';

// Image-only viewer. The basket's payment method + note are already shown in
// BasketDrawer's money section (via paymentMethodLabel), so this deliberately
// doesn't repeat them — it just pulls the private screenshot on demand. The
// link is signed server-side and expires in ~10 min, so we fetch on click
// rather than pre-loading it for every basket.

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; url: string | null };

export default function PaymentProof({ basketId }: { basketId: string }) {
  const [state, setState] = useState<State>({ phase: 'idle' });

  async function view() {
    setState({ phase: 'loading' });
    try {
      const res = await fetch(`/api/live/baskets/${basketId}/payment-proof`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ phase: 'error', message: json.error ?? 'Could not load the proof.' });
        return;
      }
      setState({ phase: 'ready', url: json.url ?? null });
    } catch {
      setState({ phase: 'error', message: 'Network trouble loading the proof.' });
    }
  }

  return (
    <div className="proof">
      {state.phase !== 'ready' && (
        <button
          type="button"
          className="proof__btn"
          disabled={state.phase === 'loading'}
          onClick={view}
        >
          {state.phase === 'loading' ? 'Loading…' : 'View payment proof'}
        </button>
      )}

      {state.phase === 'error' && <p className="proof__err">{state.message}</p>}

      {state.phase === 'ready' &&
        (state.url ? (
          <div className="proof__panel">
            <a href={state.url} target="_blank" rel="noreferrer" className="proof__imgLink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={state.url} alt="Payment proof" className="proof__img" />
              <span className="proof__open">Open full size ↗</span>
            </a>
            <button
              type="button"
              className="proof__btn proof__btn--ghost"
              onClick={() => setState({ phase: 'idle' })}
            >
              Hide
            </button>
          </div>
        ) : (
          <p className="proof__err">No image was uploaded for this basket.</p>
        ))}

      <style jsx>{`
        .proof {
          margin-top: 4px;
        }
        .proof__btn {
          min-height: 40px;
          border: 1px solid #957f67;
          border-radius: 7px;
          padding: 9px 14px;
          background: #957f67;
          color: #f5f3ef;
          font: inherit;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        }
        .proof__btn:disabled {
          cursor: wait;
          opacity: 0.65;
        }
        .proof__btn--ghost {
          margin-top: 12px;
          background: transparent;
          color: #675746;
        }
        .proof__panel {
          margin-top: 10px;
        }
        .proof__imgLink {
          display: block;
          text-decoration: none;
        }
        .proof__img {
          display: block;
          width: 100%;
          max-height: 460px;
          object-fit: contain;
          border: 1px solid rgba(149, 127, 103, 0.22);
          border-radius: 8px;
          background: #f5f3ef;
        }
        .proof__open {
          display: inline-block;
          margin-top: 8px;
          color: #957f67;
          font-size: 0.78rem;
          font-weight: 600;
        }
        .proof__err {
          margin: 8px 0 0;
          color: #9b5f5f;
          font-size: 0.8rem;
        }
      `}</style>
    </div>
  );
}
