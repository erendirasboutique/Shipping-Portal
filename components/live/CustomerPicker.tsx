'use client';

import { useEffect, useRef, useState } from 'react';
import type { CustomerRow } from '@/types/live';
import { useLocale } from '@/lib/live/i18n';

/**
 * Customer typeahead.
 *
 * The dropdown is position:fixed and measured off the input's rect rather
 * than absolutely positioned inside it. An absolute dropdown gets clipped
 * by any ancestor that scrolls or hides overflow — which is exactly what
 * happened when this lived in a wide table: you had to scroll sideways to
 * read your own search results.
 */
export default function CustomerPicker({
  value,
  onSelect,
  autoFocus,
}: {
  value: CustomerRow | null;
  onSelect: (customer: CustomerRow | null) => void;
  autoFocus?: boolean;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerRow[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [active, setActive] = useState(0);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function measure() {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) });
  }

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open]);

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
          { signal: controller.signal, cache: 'no-store' }
        );
        const json = await res.json();
        if (res.ok) {
          setResults(json.customers ?? []);
          setActive(0);
        }
      } catch {
        // aborted or offline — leave the list as it was
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if ((target as HTMLElement)?.closest?.('[data-cp-menu]')) return;
      setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  function choose(c: CustomerRow | null) {
    onSelect(c);
    setOpen(false);
    setQuery('');
  }

  if (value && !open) {
    return (
      <div className="cp__chosen">
        <div className="cp__chosenText">
          <div className="cp__chosenName">{value.name || '—'}</div>
          {value.email && <div className="cp__chosenMeta">{value.email}</div>}
        </div>
        <button
          type="button"
          className="live__undo"
          onClick={() => {
            setOpen(true);
            setQuery('');
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          {t.change}
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="cp">
      <input
        ref={inputRef}
        className="live__input"
        placeholder={t.searchCustomer}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          measure();
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          }
          if (e.key === 'Enter' && results[active]) {
            e.preventDefault();
            choose(results[active]);
          }
        }}
        aria-label={t.matchCustomer}
      />

      {open && rect && (query.trim().length >= 2 || value) && (
        <div
          data-cp-menu
          className="cp__menu"
          style={{ top: rect.top, left: rect.left, width: rect.width }}
        >
          {value && (
            <button type="button" className="cp__row cp__row--warn" onClick={() => choose(null)}>
              {t.unmatch}
            </button>
          )}

          {searching && <p className="cp__note">{t.searching}</p>}

          {!searching && results.length === 0 && query.trim().length >= 2 && (
            <p className="cp__note">
              {t.noMatches} &ldquo;{query}&rdquo;. {t.addThemFirst}
            </p>
          )}

          {results.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={`cp__row${i === active ? ' cp__row--active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(c)}
            >
              <span className="cp__rowName">{c.name || '—'}</span>
              {c.email && <span className="cp__rowMeta">{c.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
