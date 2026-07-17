'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Next 14.2 keeps server-rendered pages in a client-side Router Cache for
 * about 30 seconds. Navigate away and back — say, create a sale, land on
 * the catalog, then hit "Live sales" — and you get the *old* page. Your
 * new sale isn't there, and nothing looks broken. It just silently lies.
 *
 * Dropping this on a page forces a fresh server render every time it
 * mounts. Costs one extra request on entry. Worth it: a live sale screen
 * showing stale totals is worse than useless.
 *
 * Next 15 fixed the default. If you upgrade, this can go.
 */
export default function FreshOnMount() {
  const router = useRouter();

  useEffect(() => {
    router.refresh();
  }, [router]);

  return null;
}
