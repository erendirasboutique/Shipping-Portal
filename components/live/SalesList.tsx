'use client';

import Link from 'next/link';
import type { LiveSale } from '@/types/live';
import { centsToDisplay, formatSaleDate } from '@/lib/live/money';
import { useLocale } from '@/lib/live/i18n';

export type SaleSummary = {
  sale: LiveSale;
  basketCount: number;
  paidCount: number;
  gross: number;
};

export default function SalesList({ summaries }: { summaries: SaleSummary[] }) {
  const { t, locale } = useLocale();

  if (summaries.length === 0) {
    return (
      <div className="live__empty">
        <h2>{t.noSalesYet}</h2>
        <p className="live__muted" style={{ marginTop: 8 }}>
          {t.noSalesHint}
        </p>
      </div>
    );
  }

  return (
    <div className="sales">
      {summaries.map(({ sale, basketCount, paidCount, gross }) => (
        <article key={sale.id} className="sale">
          <div className="sale__id">
            <h2 className="sale__title">
              {sale.title || formatSaleDate(sale.sale_date, locale)}
            </h2>
            <p className="sale__date">
              {formatSaleDate(sale.sale_date, locale)}
              <span className={`live__pill live__pill--${sale.status}`}>{sale.status}</span>
            </p>
          </div>

          <div className="sale__nums">
            <span>
              <em>{t.baskets}</em>
              <b className="live__mono">{basketCount}</b>
            </span>
            <span>
              <em>{t.paid}</em>
              <b className="live__mono">
                {paidCount}
                {basketCount > 0 && <span className="live__muted">/{basketCount}</span>}
              </b>
            </span>
            <span>
              <em>{t.gross}</em>
              <b className="live__mono">{centsToDisplay(gross)}</b>
            </span>
          </div>

          <div className="sale__go">
            <Link className="tab" href={`/admin/live/${sale.id}/catalog`}>
              {t.catalog}
            </Link>
            <Link className="tab" href={`/admin/live/${sale.id}/claims`}>
              {t.runLive}
            </Link>
            <Link className="tab tab--on" href={`/admin/live/${sale.id}/baskets`}>
              {t.baskets}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
