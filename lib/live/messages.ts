import { centsToDisplay } from './money';

export type MessageLocale = 'en' | 'es';

export function portalUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://ship.erendirasboutique.com';
  return `${base.replace(/\/$/, '')}/portal/${token}`;
}

/**
 * The Thursday-night Messenger text. No total math, no item list — the
 * portal carries all of it, and it stays correct if anything changes.
 */
export function basketMessage(opts: {
  locale: MessageLocale;
  customerName?: string | null;
  basketNumber: number;
  itemCount: number;
  totalCents: number;
  portalToken: string;
  dueLabel?: string | null;
}): string {
  const {
    locale,
    customerName,
    basketNumber,
    itemCount,
    totalCents,
    portalToken,
    dueLabel,
  } = opts;

  const link = portalUrl(portalToken);
  const total = centsToDisplay(totalCents, locale);
  const firstName = customerName?.trim().split(/\s+/)[0] ?? '';

  if (locale === 'es') {
    return [
      firstName ? `¡Hola ${firstName}!` : '¡Hola!',
      '',
      `Tu canasta #${basketNumber} tiene ${itemCount} ${
        itemCount === 1 ? 'artículo' : 'artículos'
      } — total ${total}.`,
      '',
      `Mira tus fotos y paga aquí: ${link}`,
      dueLabel ? `Puedes pagar hasta el ${dueLabel}.` : '',
      '',
      'Enviamos el sábado. ¡Gracias! 🤍',
    ]
      .filter((line) => line !== '')
      .join('\n')
      .replace(/\n(?=[^\n])/g, '\n');
  }

  return [
    firstName ? `Hi ${firstName}!` : 'Hi!',
    '',
    `Your basket #${basketNumber} has ${itemCount} ${
      itemCount === 1 ? 'item' : 'items'
    } — total ${total}.`,
    '',
    `See your photos and pay here: ${link}`,
    dueLabel ? `You have until ${dueLabel} to pay.` : '',
    '',
    'We ship Saturday. Thank you! 🤍',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/** Friday reminder for anything still unpaid. */
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
      `Paga aquí antes de esta noche para que salga el sábado: ${link}`,
    ].join('\n');
  }

  return [
    firstName ? `Hi ${firstName} —` : 'Hi —',
    `Your basket #${basketNumber} (${total}) is still waiting.`,
    `Pay here by tonight and it ships Saturday: ${link}`,
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
