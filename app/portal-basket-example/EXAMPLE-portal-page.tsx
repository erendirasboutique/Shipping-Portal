/**
 * EXAMPLE ONLY — do not ship this file as-is.
 *
 * You already have a customer portal page at something like
 * app/portal/[token]/page.tsx. Don't replace it. Just drop the two
 * lines marked below into it, wherever you want the basket to appear
 * (above the address section reads well — the basket is the thing
 * they came for during sale week).
 */

import PortalBaskets from '@/components/live/PortalBaskets';
import '@/styles/live.css';

export default async function ExamplePortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main>
      {/* ...your existing portal header, greeting, order tracking... */}

      {/* ↓↓↓ the whole integration ↓↓↓ */}
      <PortalBaskets token={token} />
      {/* ↑↑↑ that's it ↑↑↑ */}

      {/* ...your existing address form, shipment status, etc... */}
    </main>
  );
}

/*
 * If your portal already knows the customer's language (you detect it
 * server-side elsewhere), pass it in instead of letting the component
 * auto-detect:
 *
 *   <PortalBaskets token={token} locale="es" />
 */
