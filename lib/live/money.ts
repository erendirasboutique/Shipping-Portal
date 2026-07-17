/** Everything in this module is integer cents. Never floats. */

export function centsToDisplay(cents: number, locale: 'en' | 'es' = 'en'): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Parses whatever a person types into a price field: "24", "24.5",
 * "$24.50", "24,50". Returns null if it isn't a usable number.
 */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$\s]/g, '').replace(',', '.');
  if (!cleaned) return null;
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;

  return Math.round(value * 100);
}

/** Normalizes a tag code so "a3 " and "A3" are the same item. */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function formatSaleDate(iso: string, locale: 'en' | 'es' = 'en'): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(
    locale === 'es' ? 'es-US' : 'en-US',
    { weekday: 'long', month: 'long', day: 'numeric' }
  );
}
