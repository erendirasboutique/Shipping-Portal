import { notFound } from 'next/navigation';
import { getBasketsForSale, getSale } from '@/lib/live/queries';
import LiveShell from '@/components/live/LiveShell';
import BasketBoard from '@/components/live/BasketBoard';
import '@/styles/live.css';

export const dynamic = 'force-dynamic';

export default async function BasketsPage({ params }: { params: { saleId: string } }) {
  const { saleId } = params;

  const sale = await getSale(saleId);
  if (!sale) return notFound();

  const baskets = await getBasketsForSale(saleId);

  return (
    <LiveShell sale={sale} active="baskets">
      <BasketBoard sale={sale} initialBaskets={baskets} />
    </LiveShell>
  );
}
