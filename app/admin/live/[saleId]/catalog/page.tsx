import { notFound } from 'next/navigation';
import { getCatalog, getSale } from '@/lib/live/queries';
import SaleHeader from '@/components/live/SaleHeader';
import CatalogManager from '@/components/live/CatalogManager';
import '@/styles/live.css';

export const dynamic = 'force-dynamic';

export default async function CatalogPage({
  params,
}: {
  params: { saleId: string };
}) {
  const { saleId } = params;

  const sale = await getSale(saleId);
  if (!sale) notFound();

  const items = await getCatalog(saleId);

  return (
    <div className="live">
      <div className="live__shell">
        <SaleHeader sale={sale} active="catalog" />
        <CatalogManager saleId={saleId} initialItems={items} />
      </div>
    </div>
  );
}
