'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LiveSale } from '@/types/live';
import { formatSaleDate } from '@/lib/live/money';
import { LocaleProvider, useLocale } from '@/lib/live/i18n';

/**
 * Wraps every admin page: locale context, header, nav, and a forced
 * refresh on mount.
 *
 * The refresh is here because Next 14.2 keeps server-rendered pages in a
 * client-side cache for ~30 seconds. Create a sale, land on the catalog,
 * click back — and you get the old page, with your new sale missing and
 * nothing looking broken. A live sale screen that shows last minute's
 * numbers is worse than one that's slow.
 */
export default function LiveShell({
  sale,
  active,
  children,
}: {
  sale?: LiveSale;
  active?: 'catalog' | 'claims' | 'baskets';
  children: any;
}) {
  return (
    <LocaleProvider>
      <Shell sale={sale} active={active}>
        {children}
      </Shell>
    </LocaleProvider>
  );
}

function Shell({
  sale,
  active,
  children,
}: {
  sale?: LiveSale;
  active?: 'catalog' | 'claims' | 'baskets';
  children: any;
}) {
  const { t, locale, setLocale } = useLocale();
  const router = useRouter();

  useEffect(() => {
    router.refresh();
  }, [router]);

  const tabs = sale
    ? ([
        { key: 'catalog', label: t.catalog, href: `/admin/live/${sale.id}/catalog` },
        { key: 'claims', label: t.runLive, href: `/admin/live/${sale.id}/claims` },
        { key: 'baskets', label: t.baskets, href: `/admin/live/${sale.id}/baskets` },
      ] as const)
    : [];

  return (
    <div className="live">
      <div className="live__shell">
        <header className="hdr">
          <div className="hdr__id">
            {sale ? (
              <>
                <p className="live__eyebrow">
                  <Link href="/admin/live" className="hdr__back">
                    ← {t.liveSales}
                  </Link>
                </p>
                <h1 className="hdr__title">
                  {sale.title || formatSaleDate(sale.sale_date, locale)}
                </h1>
              </>
            ) : (
              <>
                <p className="live__eyebrow">{t.brand}</p>
                <h1 className="hdr__title">{t.liveSales}</h1>
              </>
            )}
          </div>

          <div className="hdr__right">
            {tabs.length > 0 && (
              <nav className="tabs">
                {tabs.map((tab) => (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    className={`tab${active === tab.key ? ' tab--on' : ''}`}
                    aria-current={active === tab.key ? 'page' : undefined}
                  >
                    {tab.label}
                  </Link>
                ))}
              </nav>
            )}

            <button
              className="lang"
              onClick={() => setLocale(locale === 'en' ? 'es' : 'en')}
              aria-label={t.language}
              title={t.language}
            >
              {locale === 'en' ? 'ES' : 'EN'}
            </button>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
