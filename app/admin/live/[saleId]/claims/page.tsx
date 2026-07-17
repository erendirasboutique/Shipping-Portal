import { notFound } from 'next/navigation';
import { getCatalog, getRecentClaims, getSale } from '@/lib/live/queries';
import LiveShell from '@/components/live/LiveShell';
import ClaimEntry from '@/components/live/ClaimEntry';
import '@/styles/live.css';

export const dynamic = 'force-dynamic';

export default async function ClaimsPage({ params }: { params: { saleId: string } }) {
  const { saleId } = params;

  const sale = await getSale(saleId);
  if (!sale) return notFound();

  const [catalog, claims] = await Promise.all([getCatalog(saleId), getRecentClaims(saleId)]);

  return (
    <LiveShell sale={sale} active="claims">
      <ClaimEntry saleId={saleId} catalog={catalog} initialClaims={claims} />
    </LiveShell>
  );
}
