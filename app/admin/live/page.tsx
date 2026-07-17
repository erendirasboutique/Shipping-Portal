import Link from 'next/link';
import { listSales, getBasketTotals } from '@/lib/live/queries';
import { centsToDisplay, formatSaleDate } from '@/lib/live/money';
import NewSaleForm from '@/components/live/NewSaleForm';
import FreshOnMount from '@/components/live/FreshOnMount';
import '@/styles/live.css';

export const dynamic = 'force-dynamic';

export default async function LiveSalesPage() {
  const sales = await listSales();

  const summaries = await Promise.all(
    sales.slice(0, 12).map(async (sale) => {
      const baskets = await getBasketTotals(sale.id);
      return {
        sale,
        basketCount: baskets.length,
        paidCount: baskets.filter((b) => b.status === 'paid' || b.status === 'shipped').length,
        gross: baskets
          .filter((b) => b.status !== 'released' && b.status !== 'void')
          .reduce((sum, b) => sum + b.total_cents, 0),
      };
    })
  );

  return (
    <div className="live">
      <div className="live__shell">
        <FreshOnMount />
        <header className="live__head">
          <div>
            <p className="live__eyebrow">Erendira&rsquo;s Boutique</p>
            <h1>Live sales</h1>
          </div>
        </header>

        <div style={{ display: 'grid', gap: 28 }}>
          <NewSaleForm />

          {summaries.length === 0 ? (
            <div className="live__empty">
              <h2>No sales yet</h2>
              <p className="live__muted" style={{ marginTop: 8 }}>
                Start one above, then load the rack into its catalog before you go live.
              </p>
            </div>
          ) : (
            <section className="live__card" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="live__table">
                <thead>
                  <tr>
                    <th>Sale</th>
                    <th>Status</th>
                    <th>Baskets</th>
                    <th>Paid</th>
                    <th>Gross</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {summaries.map(({ sale, basketCount, paidCount, gross }) => (
                    <tr key={sale.id}>
                      <td>
                        <strong style={{ fontFamily: 'var(--serif)', fontSize: '1.05rem' }}>
                          {sale.title || formatSaleDate(sale.sale_date)}
                        </strong>
                        {sale.title && (
                          <div className="live__muted" style={{ fontSize: '0.8125rem' }}>
                            {formatSaleDate(sale.sale_date)}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`live__pill live__pill--${sale.status}`}>
                          {sale.status}
                        </span>
                      </td>
                      <td className="live__mono">{basketCount}</td>
                      <td className="live__mono">
                        {paidCount}
                        {basketCount > 0 && (
                          <span className="live__muted"> / {basketCount}</span>
                        )}
                      </td>
                      <td className="live__mono">{centsToDisplay(gross)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <Link className="live__tab" href={`/admin/live/${sale.id}/catalog`}>
                            Catalog
                          </Link>
                          <Link className="live__tab" href={`/admin/live/${sale.id}/claims`}>
                            Run live
                          </Link>
                          <Link className="live__tab" href={`/admin/live/${sale.id}/baskets`}>
                            Baskets
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
