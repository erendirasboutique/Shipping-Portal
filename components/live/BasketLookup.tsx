'use client';

import { useEffect, useState } from 'react';

type Hit = { basket_number: number; status: string; name: string };

const STATUS: Record<string, string> = {
  open: 'Todavía agregando',
  finalized: 'Lista para pagar',
  paid: 'Pagada',
  shipped: 'Enviada',
};

/**
 * Spanish only, deliberately — this page exists because customers ask
 * "¿qué canasta soy?" in the comments of a Spanish-language live.
 *
 * Shows a basket number and a shortened name. No totals, no link to
 * anyone's order: the portal link is the credential, and a name search
 * that handed it out would let anyone open anyone's basket.
 */
export default function BasketLookup() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 3) {
      setHits(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/live/portal/lookup?q=${encodeURIComponent(q.trim())}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const json = await res.json();
        if (res.ok) setHits(json.baskets ?? []);
      } catch {
        // aborted or offline — leave the last result up
      } finally {
        setBusy(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  return (
    <div className="lk">
      <h1 className="lk__title">Busca tu canasta</h1>
      <p className="lk__sub">Escribe tu nombre para ver tu número de canasta del live de hoy.</p>

      <input
        className="live__input lk__input"
        placeholder="Tu nombre"
        value={q}
        autoFocus
        autoComplete="off"
        onChange={(e) => setQ(e.target.value)}
        aria-label="Tu nombre"
      />

      {q.trim().length > 0 && q.trim().length < 3 && (
        <p className="lk__note">Escribe al menos 3 letras.</p>
      )}

      {busy && <p className="lk__note">Buscando…</p>}

      {!busy && hits !== null && hits.length === 0 && (
        <div className="lk__none">
          <p>No encontramos una canasta con ese nombre.</p>
          <p className="lk__hint">
            Puede ser que todavía no la hayamos registrado, o que esté con otro nombre. Mándanos un
            mensaje y te decimos.
          </p>
        </div>
      )}

      {!busy && hits && hits.length > 0 && (
        <ul className="lk__list">
          {hits.map((h) => (
            <li key={`${h.basket_number}-${h.name}`} className="lk__hit">
              <span className="lk__no live__mono">{h.basket_number}</span>
              <span className="lk__name">
                {h.name}
                <em className="lk__state">{STATUS[h.status] ?? h.status}</em>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="lk__foot">
        Para ver tu total y tus fotos, usa el enlace que te mandamos por Messenger.
      </p>
    </div>
  );
}
