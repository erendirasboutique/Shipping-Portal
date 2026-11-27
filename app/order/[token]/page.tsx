import { getBasketsForPortalToken } from '@/lib/live/queries';
import { BRAND_LOGO } from "@/lib/brand";
import { isUuid } from '@/lib/live/schema';
import PortalBaskets from '@/components/live/PortalBaskets';
import '@/styles/order.css';

export const dynamic = 'force-dynamic';

/**
 * The customer's page. Public on purpose.
 *
 * Your existing customer portal sits behind a login, which is fine for
 * someone managing their address but wrong for this: a customer taps a
 * link in Messenger to see what they owe. A sign-in wall there costs you
 * the sale. The token IS the credential — a v4 uuid nobody guesses.
 *
 * Lives on its own domain so it never inherits the portal's auth
 * middleware by accident.
 */
export const metadata = {
  title: "Tu canasta — Erendira's Boutique",
  robots: { index: false, follow: false },
  // Suppress the link-preview card when this URL is pasted into Messenger,
  // WhatsApp, iMessage, etc. Blanking the OpenGraph + Twitter tags (rather
  // than just omitting them) gives scrapers nothing to build a card from,
  // so the link stays plain text in the chat.
  openGraph: { images: [], title: '', description: '' },
  twitter: { card: 'summary', images: [], title: '', description: '' },
  other: { 'og:image': '' },
};

export default async function OrderPage({ params }: { params: { token: string } }) {
  const { token } = params;

  // Look it up server-side so a bad link says so immediately, rather than
  // flashing a loading state and then an error.
  const known = isUuid(token) ? (await getBasketsForPortalToken(token)).length > 0 : false;

  if (known) {
    return (
      <div className="mb-page">
        <PortalBaskets token={token} />
      </div>
    );
  }

  return (
    <div className="mb-page">
      <div className="mb">
        <header className="mb-head">
          <img className="mb-logo" src={BRAND_LOGO} alt="Erendira's Boutique" />
        </header>
        <section className="mb-card mb-lost">
          <h1 className="mb-h2">Enlace no encontrado</h1>
          <p className="mb-muted">
            Este enlace puede haber expirado o se copió incompleto. Mándanos un mensaje y te
            enviamos uno nuevo.
          </p>
          <p className="mb-muted mb-small">
            This link may have expired or was copied incompletely. Message us and we&rsquo;ll send a new one.
          </p>
        </section>
      </div>
    </div>
  );
}
