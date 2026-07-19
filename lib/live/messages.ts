import { centsToDisplay } from './money';

export type MessageLocale = 'en' | 'es';

/**
 * Builds the customer's portal link.
 *
 * The path is configurable because this module doesn't own the customer
 * portal — your existing app does. If yours lives at /p/{token} or
 * /customer/{token} rather than /portal/{token}, set
 * NEXT_PUBLIC_PORTAL_PATH and nothing in here needs editing.
 *
 * Quickest way to find the right value: open any shipping notification
 * email and look at the "Customer portal" button's URL.
 */
export function portalUrl(token: string): string {
  const base = (
    process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://order.erendirasboutique.com'
  ).replace(/\/+$/, '');

  // '' means the token sits at the root of the domain, which is what the
  // rewrite in next.config.js gives you: order.erendirasboutique.com/{token}
  const raw = process.env.NEXT_PUBLIC_PORTAL_PATH ?? '/order';
  const path = raw.trim() === '' || raw.trim() === '/'
    ? ''
    : raw.replace(/^\/*/, '/').replace(/\/+$/, '');

  return `${base}${path}/${token}`;
}

/**
 * The Thursday-night message. Always Spanish.
 *
 * Not locale-dependent, on purpose: this goes to your customers, and your
 * customers read Spanish. The EN/ES toggle in the admin is for the person
 * running the sale — it shouldn't change what a customer receives. One
 * wrong toggle shouldn't send 150 people the wrong language.
 *
 * The wording is Erendira's, verbatim. Don't "improve" it.
 */
export function basketMessage(opts: {
  locale?: MessageLocale;
  customerName?: string | null;
  basketNumber?: number;
  itemCount?: number;
  totalCents: number;
  portalToken: string;
  dueLabel?: string | null;
  /**
   * Pre-resolved short link. When present (the drawer fetches the dub link
   * on open), it's used instead of the long portal URL — so the message the
   * customer receives carries the branded short link, not the raw uuid one.
   */
  overrideLink?: string | null;
}): string {
  const link = opts.overrideLink || portalUrl(opts.portalToken);
  const total = centsToDisplay(opts.totalCents, 'es');

  return `Hola Chula Serian ${total}\nVer tu pedido: ${link}`;
}

/** Friday reminder for anything still unpaid. */
/**
 * The "we opened your basket" heads-up, sent while the live is still going.
 * Warm and short — tells them they can watch their basket fill up and that
 * payment comes after the live wraps. Spanish only, by design.
 *
 * Uses the short link when one is passed in (the drawer resolves it), else
 * the long portal URL.
 */
export function inviteMessage(opts: {
  portalToken: string;
  overrideLink?: string | null;
}): string {
  const link = opts.overrideLink || portalUrl(opts.portalToken);
  return (
    'Hola chula! \uD83C\uDF38 Te abrimos tu canasta. ' +
    'Mira aqu\u00ED lo que vas apartando y lo pagas cuando te mandemos tu total' +
    link
  );
}

export function reminderMessage(opts: {
  locale: MessageLocale;
  customerName?: string | null;
  basketNumber: number;
  totalCents: number;
  portalToken: string;
}): string {
  const { locale, customerName, basketNumber, totalCents, portalToken } = opts;
  const link = portalUrl(portalToken);
  const total = centsToDisplay(totalCents, locale);
  const firstName = customerName?.trim().split(/\s+/)[0] ?? '';

  if (locale === 'es') {
    return [
      firstName ? `Hola ${firstName} —` : 'Hola —',
      `Tu canasta #${basketNumber} (${total}) todavía está esperando.`,
      `Detalles para pagar aquí — antes de esta noche y sale el sábado: ${link}`,
    ].join('\n');
  }

  return [
    firstName ? `Hi ${firstName} —` : 'Hi —',
    `Your basket #${basketNumber} (${total}) is still waiting.`,
    `Payment details here — pay by tonight and it ships Saturday: ${link}`,
  ].join('\n');
}

export function dueLabel(iso: string | null, locale: MessageLocale): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString(locale === 'es' ? 'es-US' : 'en-US', {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });
}
