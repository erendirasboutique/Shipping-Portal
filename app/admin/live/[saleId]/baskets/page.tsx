import { notFound } from 'next/navigation';
import { getBasketDetail, getBasketTotals, getSale } from '@/lib/live/queries';
import type { BasketDetail } from '@/types/live';
import LiveShell from '@/components/live/LiveShell';
import BasketBoard from '@/components/live/BasketBoard';
import '@/styles/live.css';

export const dynamic = 'force-dynamic';

export default async function BasketsPage({ params }: { params: { saleId: string } }) {
  const { saleId } = params;

  const sale = await getSale(saleId);
  if (!sale) return notFound();

  const totals = await getBasketTotals(saleId);
  const baskets = (await Promise.all(totals.map((t) => getBasketDetail(t.basket_id)))).filter(
    (b): b is BasketDetail => b !== null
  );

  return (
    <LiveShell sale={sale} active="baskets">
      <BasketBoard sale={sale} initialBaskets={baskets} />
    </LiveShell>
  );
}
