/**
 * Every assumption this module makes about YOUR existing tables lives
 * here. Rename something in Supabase later and this is the only file
 * that needs to change.
 *
 * The module's own tables (live_sales, live_items, baskets,
 * basket_items) aren't here — those are ours and won't move.
 */

export const CUSTOMERS_TABLE = 'shipping_customers';
export const ORDERS_TABLE = 'shipping_orders';

/** Columns the module reads off shipping_customers. */
export const CUSTOMER_COLS = {
  id: 'id',
  name: 'name',
  email: 'email',
  phone: 'phone',
  portalToken: 'portal_token',
  /** Soft-delete flag. Archived customers stay out of the typeahead. */
  archived: 'archived',
  /** Set when a duplicate was merged away. Merged rows stay out too. */
  mergedInto: 'merged_into',
} as const;

/** Address columns copied onto an order when a basket is paid. */
export const CUSTOMER_ADDRESS_COLS = {
  street1: 'street1',
  street2: 'street2',
  city: 'city',
  state: 'state',
  zip: 'zip',
  country: 'country',
} as const;

/** Everything needed to build a shipping_orders row from a customer. */
export const CUSTOMER_ADDRESS_SELECT = [
  CUSTOMER_COLS.id,
  CUSTOMER_COLS.name,
  CUSTOMER_COLS.email,
  CUSTOMER_COLS.phone,
  ...Object.values(CUSTOMER_ADDRESS_COLS),
].join(', ');

/** What we select when we need a customer for a basket. */
export const CUSTOMER_SELECT = `${CUSTOMER_COLS.id}, ${CUSTOMER_COLS.name}, ${CUSTOMER_COLS.email}, ${CUSTOMER_COLS.portalToken}`;

/** What the typeahead shows. */
export const CUSTOMER_SEARCH_SELECT = `${CUSTOMER_SELECT}, ${CUSTOMER_COLS.phone}`;

/** Columns the typeahead searches across. */
export const CUSTOMER_SEARCH_COLS = [
  CUSTOMER_COLS.name,
  CUSTOMER_COLS.email,
  CUSTOMER_COLS.phone,
];

/**
 * How a customer paid. Staff pick one when marking a basket paid —
 * nothing here is ever set automatically.
 *
 * Order matters: this is the order they appear in the picker, so the
 * ones you actually use should come first.
 */
export const PAYMENT_METHODS = [
  { value: 'zelle', label: 'Zelle', label_es: 'Zelle' },
  { value: 'cashapp', label: 'Cash App', label_es: 'Cash App' },
  { value: 'venmo', label: 'Venmo', label_es: 'Venmo' },
  { value: 'paypal', label: 'PayPal', label_es: 'PayPal' },
  { value: 'cash', label: 'Cash', label_es: 'Efectivo' },
  { value: 'applepay', label: 'Apple Pay', label_es: 'Apple Pay' },
  { value: 'stripe', label: 'Card (Stripe)', label_es: 'Tarjeta (Stripe)' },
  { value: 'other', label: 'Other', label_es: 'Otro' },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

export function paymentMethodLabel(value: string | null): string {
  if (!value) return '—';
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
}

/**
 * Status stamped on an order that gets created when a basket is paid.
 *
 * Your vocabulary is purchased / refunded / draft. An order that exists
 * but has no postage yet is a draft — that's what Saturday turns into
 * purchased. Change this if that ever stops being true.
 */
export const NEW_ORDER_STATUS = 'draft';

/**
 * order_number is fed by shipping_order_number_seq. Never set it on
 * insert — let the sequence hand out the next one, or two orders created
 * in the same second will collide.
 */
export const ORDER_NUMBER_COL = 'order_number';

/**
 * How a basket was paid. Recorded by hand — most customers don't use
 * Stripe, so there's nothing to sync from.
 *
 * No database check constraint backs this list on purpose: adding a
 * method should be a one-line edit here, not a migration.
 */
export const PAYMENT_METHODS = [
  { value: 'zelle', label: 'Zelle' },
  { value: 'cash_app', label: 'Cash App' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'apple_pay', label: 'Apple Pay' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

const METHOD_VALUES = new Set(PAYMENT_METHODS.map((m) => m.value as string));

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && METHOD_VALUES.has(value);
}

export function paymentMethodLabel(value: string | null): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? '—';
}

/**
 * portal_token is a uuid column, not text. Postgres throws 22P02 on a
 * malformed uuid rather than returning no rows, so anything compared
 * against it gets checked first.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
