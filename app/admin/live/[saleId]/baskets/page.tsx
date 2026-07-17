import { notFound } from 'next/navigation';
import { getBasketDetail, getBasketTotals, getSale } from '@/lib/live/queries';
import SaleHeader from '@/components/live/SaleHeader';
import BasketBoard from '@/components/live/BasketBoard';
import '@/styles/live.css';

export const dynamic = 'force-dynamic';

export default async function BasketsPage({
  params,
}: {
  params: { saleId: string };
}) {
  const { saleId } = params;

  const sale = await getSale(saleId);
  if (!sale) notFound();

  const totals = await getBasketTotals(saleId);
  const baskets = (
    await Promise.all(totals.map((t) => getBasketDetail(t.basket_id)))
  ).filter((b): b is NonNullable<typeof b> => b !== null);

  return (
    <div className="live">
      <div className="live__shell">
        <SaleHeader sale={sale} active="baskets" />
        <BasketBoard sale={sale} initialBaskets={baskets} />
      </div>
    </div>
  );
}
