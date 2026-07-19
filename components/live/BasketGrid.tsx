'use client';

import { useMemo } from 'react';
import type { BasketDetail } from '@/types/live';
import { centsToDisplay } from '@/lib/live/money';
import { useLocale } from '@/lib/live/i18n';

/**
 * The basket wall.
 *
 * A 150-row table was the wrong shape for this. The baskets are physical
 * objects in numbered order on a rack — the screen should look like the
 * rack. Every number from 1 to the highest claimed is here, empty ones
 * included, so a gap on screen is a gap in the room.
 *
 * Tiles are keyed by status, not decorated by it:
 *   outline  empty, nothing claimed
 *   sand     open, still filling
 *   ink      finalized, waiting on money
 *   green    paid
 *   red      released
 */
export default function BasketGrid({
  baskets,
  selectedId,
  onSelect,
  minTiles = 48,
  selectMode = false,
  selectedIds,
  onToggleSelect,
}: {
  baskets: BasketDetail[];
  selectedId: string | null;
  onSelect: (basketNumber: number) => void;
  minTiles?: number;
  /** Merge mode: tiles toggle a selection instead of opening the drawer. */
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (basketId: string) => void;
}) {
  const { t } = useLocale();

  const { tiles, byNumber } = useMemo(() => {
    const map = new Map<number, BasketDetail>();
    for (const b of baskets) map.set(b.basket_number, b);

    const highest = baskets.reduce((max, b) => Math.max(max, b.basket_number), 0);
    // Always show a full last row, and never fewer than minTiles, so
    // there's somewhere to aim when the next number gets called.
    const target = Math.max(highest + 8, minTiles);
    const count = Math.ceil(target / 16) * 16;

    return {
      tiles: Array.from({ length: count }, (_, i) => i + 1),
      byNumber: map,
    };
  }, [baskets, minTiles]);

  return (
    <div className="wall" role="list">
      {tiles.map((n) => {
        const basket = byNumber.get(n);
        const state = !basket ? 'empty' : basket.status;
        const selected = basket && basket.id === selectedId;
        const picked = basket && selectedIds?.has(basket.id);

        return (
          <button
            key={n}
            role="listitem"
            type="button"
            className={`tile tile--${state}${selected ? ' tile--on' : ''}${
              picked ? ' tile--picked' : ''
            }`}
            onClick={() => {
              if (selectMode) {
                // In merge mode, tapping a real basket toggles it; empty
                // tiles do nothing.
                if (basket && onToggleSelect) onToggleSelect(basket.id);
              } else {
                onSelect(n);
              }
            }}
            aria-label={
              basket
                ? `${t.basket} ${n}, ${basket.item_count} ${t.items}, ${centsToDisplay(
                    basket.total_cents
                  )}`
                : `${t.basket} ${n}, ${t.empty}`
            }
          >
            <span className="tile__no">{n}</span>

            {basket ? (
              <>
                <span className="tile__total">{centsToDisplay(basket.total_cents)}</span>
                <span className="tile__who">
                  {basket.customer?.name ?? (
                    <em className="tile__unmatched">{t.unmatched}</em>
                  )}
                </span>
                <span className="tile__count">
                  {basket.item_count} {t.items.toLowerCase()}
                </span>

                {/* A note you can't see from the wall is a note you'll miss.
                    First line only — enough to spot "Pickup" across 80
                    tiles without turning each one into a paragraph. */}
                {basket.notes && (
                  <span className="tile__note" title={basket.notes}>
                    {basket.notes.split('\n')[0]}
                  </span>
                )}
              </>
            ) : (
              <span className="tile__empty">{t.empty}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
