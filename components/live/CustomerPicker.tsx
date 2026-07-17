'use client';

import { useEffect, useRef, useState } from 'react';

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  portal_token?: string | null;
};

export default function CustomerPicker({
  value,
  onSelect,
}: {
  value: Customer | null;
  onSelect: (customer: Customer | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/live/customers/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        const json = await res.json();
        if (res.ok) setResults(json.customers ?? []);
      } catch {
        /* aborted or offline — the field just shows nothing */
      } finally {
        setSearching(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  if (value && !open) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.9375rem' }}>{value.name || 'Unnamed'}</div>
          {value.email && (
            <div className="live__muted" style={{ fontSize: '0.75rem' }}>
              {value.email}
            </div>
          )}
        </div>
        <button
          className="live__undo"
          onClick={() => {
            setOpen(true);
            setQuery('');
          }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        className="live__input"
        style={{ padding: '7px 10px', fontSize: '0.875rem' }}
        placeholder="Search name, email, phone"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label="Match this basket to a customer"
      />

      {open && (query.trim().length >= 2 || value) && (
        <div
          style={{
            position: 'absolute',
            zIndex: 20,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            minWidth: 240,
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(61, 52, 40, 0.12)',
            overflow: 'hidden',
          }}
        >
          {value && (
            <button
              className="live__undo"
              style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--line)', padding: 10 }}
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
            >
              Unmatch
            </button>
          )}

          {searching && (
            <p className="live__muted" style={{ padding: 12, margin: 0, fontSize: '0.8125rem' }}>
              Searching…
            </p>
          )}

          {!searching && results.length === 0 && query.trim().length >= 2 && (
            <p className="live__muted" style={{ padding: 12, margin: 0, fontSize: '0.8125rem' }}>
              No one matches &ldquo;{query}&rdquo;. Add them on the customers page first.
            </p>
          )}

          {results.map((customer) => (
            <button
              key={customer.id}
              onClick={() => {
                onSelect(customer);
                setOpen(false);
                setQuery('');
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid var(--line)',
                cursor: 'pointer',
                fontFamily: 'var(--body)',
                color: 'var(--ink)',
              }}
            >
              <div style={{ fontSize: '0.875rem' }}>{customer.name || 'Unnamed'}</div>
              {customer.email && (
                <div className="live__muted" style={{ fontSize: '0.75rem' }}>
                  {customer.email}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
