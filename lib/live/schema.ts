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
 * portal_token is a uuid column, not text. Postgres throws 22P02 on a
 * malformed uuid rather than returning no rows, so anything compared
 * against it gets checked first.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
