'use client';

import { useCallback, useEffect, useState } from 'react';
import NewSaleForm from '@/components/live/NewSaleForm';
import SalesList, { type SaleSummary } from '@/components/live/SalesList';

/**
 * Owns the sales list on the client.
 *
 * The server render seeds the first paint, but this re-reads the API on
 * mount and after a sale is created. That's the fix for "I made a sale and
 * it says No sales yet": the sale always saved — Next 14 was serving a
 * cached copy of the page from before it existed, and a server component's
 * fresh props can't overwrite client state anyway.
 */
export default function SalesBoard({ initialSummaries }: { initialSummaries: SaleSummary[] }) {
  const [summaries, setSummaries] = useState<SaleSummary[]>(initialSummaries);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/live/sales?summary=1', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && Array.isArray(json.summaries)) setSummaries(json.summaries);
    } catch {
      // keep what's on screen
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="page">
      <NewSaleForm onCreated={reload} />
      <SalesList summaries={summaries} />
    </div>
  );
}
