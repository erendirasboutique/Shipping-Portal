import BasketLookup from '@/components/live/BasketLookup';
import '@/styles/live.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Busca tu canasta — Erendira's Boutique",
  openGraph: { images: [], title: '', description: '' },
  twitter: { card: 'summary', images: [], title: '', description: '' },
  other: { 'og:image': '' },
  robots: { index: false, follow: false },
};

/**
 * "¿Qué número de canasta soy?" — the question asked fifty times in the
 * comments of every live. Public, Spanish, no login.
 */
export default function BuscarPage() {
  return (
    <div className="live order">
      <div className="order__shell">
        <header className="order__head">
          <img className="order__logo" src="/logo.png" alt="Erendira's Boutique" />
        </header>

        <BasketLookup />

        <footer className="order__foot">
          <p>Erendira&rsquo;s Boutique</p>
        </footer>
      </div>
    </div>
  );
}
