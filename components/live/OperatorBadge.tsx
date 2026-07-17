'use client';

import { useEffect, useRef, useState } from 'react';
import { getOperator, setOperator } from '@/lib/live/operator';
import { useLocale } from '@/lib/live/i18n';

/**
 * Who's clicking, shown in the header.
 *
 * Every basket and every claim gets stamped with this name, which is the
 * thing you actually want to know on Thursday when a total looks wrong.
 * It's per browser, so the machine at the rack and the one at the desk
 * can be different people without anyone signing in and out.
 */
export default function OperatorBadge() {
  const { t } = useLocale();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setName(getOperator());
  }, []);

  useEffect(() => {
    function away(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  function save() {
    const v = draft.trim();
    setOperator(v);
    setName(v);
    setOpen(false);
  }

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';

  return (
    <div ref={boxRef} className="op">
      <button
        className={`op__btn${name ? '' : ' op__btn--unset'}`}
        onClick={() => {
          setDraft(name);
          setOpen((v) => !v);
        }}
        title={name ? `${t.operator} ${name}` : t.whoName}
      >
        {initials}
      </button>

      {open && (
        <div className="op__pop">
          <label className="live__label" htmlFor="op-name">
            {t.whoName}
          </label>
          <input
            id="op-name"
            className="live__input"
            value={draft}
            autoFocus
            placeholder="Erendira"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setOpen(false);
            }}
          />
          <p className="op__hint">{t.operatorHint}</p>
          <button className="live__btn op__save" onClick={save}>
            {t.save}
          </button>
        </div>
      )}
    </div>
  );
}
