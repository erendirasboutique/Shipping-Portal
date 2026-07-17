import { notFound } from 'next/navigation';
import { getCatalog, getRecentClaims, getSale } from '@/lib/live/queries';
import SaleHeader from '@/components/live/SaleHeader';
import ClaimEntry from '@/components/live/ClaimEntry';
import '@/styles/live.css';

export const dynamic = 'force-dynamic';

export default async function ClaimsPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const { saleId } = await params;

  const sale = await getSale(saleId);
  if (!sale) notFound();

  const [catalog, claims] = await Promise.all([
    getCatalog(saleId),
    getRecentClaims(saleId),
  ]);

  return (
    <div className="live">
      <div className="live__shell">
        <SaleHeader sale={sale} active="claims" />
        <ClaimEntry saleId={saleId} catalog={catalog} initialClaims={claims} />
      </div>
    </div>
  );
}
