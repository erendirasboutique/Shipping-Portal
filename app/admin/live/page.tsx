import { listSales, getBasketTotals } from '@/lib/live/queries';
import LiveShell from '@/components/live/LiveShell';
import NewSaleForm from '@/components/live/NewSaleForm';
import SalesList from '@/components/live/SalesList';
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
    <LiveShell>
      <div className="page">
        <NewSaleForm />
        <SalesList summaries={summaries} />
      </div>
    </LiveShell>
  );
}
