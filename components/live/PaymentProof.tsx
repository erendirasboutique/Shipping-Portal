'use client';

import { useState } from 'react';

// Matches the values the customer form submits in PortalBaskets.tsx.
const METHOD_LABELS: Record<string, string> = {
  zelle: 'Zelle',
  cash_app: 'Cash App',
  venmo: 'Venmo',
  paypal: 'PayPal',
  apple_pay: 'Apple Pay',
  other: 'Other',
};

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; url: string | null; method: string | null; note: string | null };

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
      setState({
        phase: 'ready',
        url: json.url ?? null,
        method: json.method ?? null,
        note: json.note ?? null,
      });
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

      {state.phase === 'ready' && (
        <div className="proof__panel">
          <div className="proof__row">
            <span className="proof__label">Method</span>
            <span className="proof__value">
              {state.method ? METHOD_LABELS[state.method] ?? state.method : '—'}
            </span>
          </div>

          {state.note && (
            <div className="proof__row">
              <span className="proof__label">Note</span>
              <span className="proof__value">{state.note}</span>
            </div>
          )}

          {state.url ? (
            <a href={state.url} target="_blank" rel="noreferrer" className="proof__imgLink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={state.url} alt="Payment proof" className="proof__img" />
              <span className="proof__open">Open full size ↗</span>
            </a>
          ) : (
            <p className="proof__err">No image was uploaded for this basket.</p>
          )}

          <button
            type="button"
            className="proof__btn proof__btn--ghost"
            onClick={() => setState({ phase: 'idle' })}
          >
            Hide
          </button>
        </div>
      )}

      <style jsx>{`
        .proof {
          margin-top: 12px;
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
          padding: 14px;
          border: 1px solid rgba(149, 127, 103, 0.22);
          border-radius: 10px;
          background: #fffdf9;
        }
        .proof__row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 6px 0;
          font-size: 0.83rem;
        }
        .proof__label {
          color: #8f8174;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 0.72rem;
        }
        .proof__value {
          color: #675746;
          font-weight: 600;
        }
        .proof__imgLink {
          display: block;
          margin-top: 10px;
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
