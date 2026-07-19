import { getBasketsForPortalToken } from '@/lib/live/queries';
import { isUuid } from '@/lib/live/schema';
import PortalBaskets from '@/components/live/PortalBaskets';
import '@/styles/live.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Your basket — Erendira's Boutique",
  robots: { index: false, follow: false },
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }> | { token: string };
}) {
  const { token } = await params;

  const known = isUuid(token)
    ? (await getBasketsForPortalToken(token)).length > 0
    : false;

  return (
    <main className="orderPage">
      <div className="orderPage__shell">
        <header className="orderPage__header">
          <img
            className="orderPage__logo"
            src="/logo.png"
            alt="Erendira's Boutique"
          />
        </header>

        {!known ? (
          <div className="orderPage__empty">
            <h1>Link not found</h1>

            <p>
              This link may have expired, or it was copied incompletely.
              <br />
              Message us and we&rsquo;ll send a new one.
            </p>

            <p>
              Este enlace puede haber expirado o se copió incompleto.
              Mándanos un mensaje y te enviamos uno nuevo.
            </p>
          </div>
        ) : (
          <PortalBaskets token={token} />
        )}

        <footer className="orderPage__footer">
          <p>Erendira&rsquo;s Boutique</p>
        </footer>
      </div>

      <style>{`
        .orderPage {
          min-height: 100vh;
          margin: 0;
          padding: 24px;
          background: #f5f3ef;
        }

        .orderPage__shell {
          width: min(100%, 1540px);
          margin: 0 auto;
        }

        .orderPage__header {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 94px;
          padding: 8px 0 22px;
        }

        .orderPage__logo {
          display: block;
          width: auto;
          max-width: min(240px, 64vw);
          max-height: 82px;
          object-fit: contain;
        }

        .orderPage__empty {
          width: min(100%, 680px);
          margin: 40px auto;
          padding: 48px 30px;
          border: 1px solid rgba(149, 127, 103, 0.22);
          border-radius: 14px;
          background: #fffdf9;
          color: #957f67;
          text-align: center;
        }

        .orderPage__empty h1 {
          margin: 0 0 18px;
          font-family: 'La Luxes Serif', serif;
          font-size: clamp(2.2rem, 5vw, 3.8rem);
          font-weight: 400;
        }

        .orderPage__empty p {
          margin: 12px 0 0;
          color: #8f8174;
          font-family: 'Recoleta', Georgia, serif;
          line-height: 1.65;
        }

        .orderPage__footer {
          padding: 32px 0 14px;
          color: #957f67;
          font-family: 'Recoleta', Georgia, serif;
          font-size: 0.76rem;
          letter-spacing: 0.12em;
          text-align: center;
          text-transform: uppercase;
        }

        .orderPage__footer p {
          margin: 0;
        }

        @media (max-width: 640px) {
          .orderPage {
            padding: 10px;
          }

          .orderPage__header {
            min-height: 74px;
            padding-bottom: 12px;
          }

          .orderPage__logo {
            max-height: 60px;
          }
        }
      `}</style>
    </main>
  );
}
