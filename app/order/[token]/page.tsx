import { getBasketsForPortalToken } from '@/lib/live/queries';
import { isUuid } from '@/lib/live/schema';
import PortalBaskets from '@/components/live/PortalBaskets';
import '@/styles/live.css';

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
  title: "Your basket — Erendira's Boutique",
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

  return (
    <div className="live order">
      <div className="order__shell">
        <header className="order__head">
          <img className="order__logo" src="/logo.png" alt="Erendira's Boutique" />
        </header>

        {!known ? (
          <div className="live__empty">
            <h2>Link not found</h2>
            <p className="live__muted" style={{ marginTop: 8 }}>
              This link may have expired, or it was copied incompletely.
              <br />
              Message us and we&rsquo;ll send a new one.
            </p>
            <p className="live__muted" style={{ marginTop: 16, fontSize: '0.875rem' }}>
              Este enlace puede haber expirado o se copió incompleto. Mándanos un mensaje y te
              enviamos uno nuevo.
            </p>
          </div>
        ) : (
          <PortalBaskets token={token} />
        )}

        <footer className="order__foot">
          <p>Erendira&rsquo;s Boutique</p>
        </footer>
      </div>
    </div>
  );
}
