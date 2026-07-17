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

/** What we select when we need a customer for a basket. */
export const CUSTOMER_SELECT = `${CUSTOMER_COLS.id}, ${CUSTOMER_COLS.name}, ${CUSTOMER_COLS.email}, ${CUSTOMER_COLS.portalToken}`;

/** What the typeahead shows. */
export const CUSTOMER_SEARCH_SELECT = `${CUSTOMER_SELECT}, ${CUSTOMER_COLS.phone}`;

/** Everything needed to build a shipping_orders row from a customer. */
export const CUSTOMER_ADDRESS_SELECT = [
  CUSTOMER_COLS.id,
  CUSTOMER_COLS.name,
  CUSTOMER_COLS.email,
  CUSTOMER_COLS.phone,
  ...Object.values(CUSTOMER_ADDRESS_COLS),
].join(', ');

/** Columns the typeahead searches across. */
export const CUSTOMER_SEARCH_COLS = [
  CUSTOMER_COLS.name,
  CUSTOMER_COLS.email,
  CUSTOMER_COLS.phone,
];

/**
 * Status stamped on an order created when a basket is marked paid.
 *
 * Your vocabulary is purchased / refunded / draft. An order that exists
 * but has no postage yet is a draft — that's what Saturday turns into
 * purchased. Change this if that ever stops being true.
 */
export const NEW_ORDER_STATUS = 'draft';

/**
 * How a customer paid. Staff pick one when marking a basket paid —
 * nothing here is ever set automatically.
 *
 * These values MUST match the check constraint in
 * 20260716000200_manual_payments.sql. Adding a method means editing both.
 *
 * Order matters: this is the order they appear in the picker, so the
 * ones you actually use come first.
 */
export const PAYMENT_METHODS = [
  { value: 'zelle', label: 'Zelle', label_es: 'Zelle' },
  { value: 'cashapp', label: 'Cash App', label_es: 'Cash App' },
  { value: 'venmo', label: 'Venmo', label_es: 'Venmo' },
  { value: 'paypal', label: 'PayPal', label_es: 'PayPal' },
  { value: 'cash', label: 'Cash', label_es: 'Efectivo' },
  { value: 'applepay', label: 'Apple Pay', label_es: 'Apple Pay' },
  { value: 'stripe', label: 'Card', label_es: 'Tarjeta' },
  { value: 'other', label: 'Other', label_es: 'Otro' },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

const METHOD_VALUES = new Set(PAYMENT_METHODS.map((m) => m.value as string));

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && METHOD_VALUES.has(value);
}

export function paymentMethodLabel(value: string | null): string {
  if (!value) return '—';
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
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
