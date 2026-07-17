import { notFound } from 'next/navigation';
import { getCatalog, getSale } from '@/lib/live/queries';
import LiveShell from '@/components/live/LiveShell';
import CatalogManager from '@/components/live/CatalogManager';
import '@/styles/live.css';

export const dynamic = 'force-dynamic';

export default async function CatalogPage({ params }: { params: { saleId: string } }) {
  const { saleId } = params;

  const sale = await getSale(saleId);
  if (!sale) return notFound();

  const items = await getCatalog(saleId);

  return (
    <LiveShell sale={sale} active="catalog">
      <CatalogManager saleId={saleId} initialItems={items} />
    </LiveShell>
  );
}
