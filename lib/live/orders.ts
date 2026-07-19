import { recordEvent } from './timeline';
import { asRow, liveDb } from './supabase';
import type { CustomerAddressRow } from '@/types/live';
import {
  CUSTOMERS_TABLE,
  CUSTOMER_ADDRESS_SELECT,
  CUSTOMER_COLS,
  NEW_ORDER_STATUS,
  ORDERS_TABLE,
} from './schema';
import { formatSaleDate } from './money';

/**
 * Creates the shipping_orders row for a paid basket and links it back.
 *
 * Deliberately NOT setting order_number — shipping_order_number_seq feeds
 * that column, and letting Postgres hand out the value is the only way two
 * orders created in the same second can't collide.
 *
 * Idempotent, because Stripe retries webhooks and will happily deliver the
 * same checkout.session.completed twice.
 *
 * Returns the order id, or null if the basket can't become an order yet.
 */
export async function createOrderForBasket(basketId: string): Promise<string | null> {
  const db = liveDb();

  const basket = await db
    .from('baskets')
    .select('id, basket_number, customer_id, order_id, live_sale_id')
    .eq('id', basketId)
    .maybeSingle();

  if (basket.error) throw new Error(basket.error.message);
  if (!basket.data) return null;

  // Already has an order — a retried webhook, or a staffer beat us to it.
  if (basket.data.order_id) return basket.data.order_id;

  if (!basket.data.customer_id) {
    console.warn('[live] basket has no customer, skipping order', basketId);
    return null;
  }

  const customer = await db
    .from(CUSTOMERS_TABLE)
    .select(CUSTOMER_ADDRESS_SELECT)
    .eq(CUSTOMER_COLS.id, basket.data.customer_id)
    .maybeSingle();

  if (customer.error) throw new Error(customer.error.message);

  const c = asRow<CustomerAddressRow>(customer.data);
  if (!c) {
    console.warn('[live] customer missing, skipping order', basket.data.customer_id);
    return null;
  }

  const sale = await db
    .from('live_sales')
    .select('sale_date, title')
    .eq('id', basket.data.live_sale_id)
    .maybeSingle();

  const saleLabel = sale.data
    ? sale.data.title || formatSaleDate(sale.data.sale_date)
    : 'Live sale';

  // A blank address still becomes a draft — staff fill it in on Saturday
  // the same way they do for any other order. Silently dropping the order
  // would be worse: the customer paid.
  const hasAddress = Boolean(c.street1 && c.city && c.state && c.zip);

  const order = await db
    .from(ORDERS_TABLE)
    .insert({
      customer_id: basket.data.customer_id,
      to_name: c.name,
      to_street1: c.street1,
      to_street2: c.street2,
      to_city: c.city,
      to_state: c.state,
      to_zip: c.zip,
      to_country: c.country || 'US',
      to_phone: c.phone,
      to_email: c.email,
      status: NEW_ORDER_STATUS,
      notes: [
        `${saleLabel} · Basket #${basket.data.basket_number}`,
        hasAddress ? null : 'ADDRESS NEEDED — customer record was incomplete',
      ]
        .filter(Boolean)
        .join('\n'),
      // order_number omitted on purpose. The sequence owns it.
    })
    .select('id, order_number')
    .single();

  if (order.error) throw new Error(order.error.message);

  // Link it back, but only if nothing else claimed the basket while we
  // were inserting. If the guard finds order_id already set, a duplicate
  // webhook won the race and we clean up the row we just made.
  const link = await db
    .from('baskets')
    .update({ order_id: order.data.id })
    .eq('id', basketId)
    .is('order_id', null)
    .select('id')
    .maybeSingle();

  if (link.error) throw new Error(link.error.message);

  if (!link.data) {
    await db.from(ORDERS_TABLE).delete().eq('id', order.data.id);

    const winner = await db
      .from('baskets')
      .select('order_id')
      .eq('id', basketId)
      .maybeSingle();

    return winner.data?.order_id ?? null;
  }

  return order.data.id;
}

/**
 * Link a basket to an existing shipping order, both directions.
 *
 * Used by (a) the drawer's "attach to existing order" picker and (b) the
 * create-label page's basket-number field. Sets the basket's order_id so
 * tracking flows to the customer's portal (the portal reads tracking
 * through order_id), and records it on the timeline.
 *
 * Idempotent: linking a basket that's already on this order is a no-op.
 */
export async function linkBasketToOrder(opts: {
  basketId: string;
  orderId: string;
  actor?: string;
}): Promise<void> {
  const db = liveDb();

  const { error } = await db
    .from('baskets')
    .update({ order_id: opts.orderId })
    .eq('id', opts.basketId);

  if (error) throw new Error(error.message);

  await recordEvent({
    basketId: opts.basketId,
    kind: 'linked_order',
    actor: opts.actor,
    detail: { order_id: opts.orderId },
  });
}

/**
 * Find an open basket by number in the MOST RECENT live sale.
 *
 * This is what the create-label page calls: the operator types a basket
 * number, and we resolve it against the newest sale (the one being shipped
 * this week). Returns null if there's no such basket — the label still
 * buys, it just isn't linked.
 *
 * "Most recent" = newest sale by created_at. Per Dylan: always the current
 * week's sale, so basket #12 means #12 in the newest sale, unambiguously.
 */
export async function findBasketByNumberInLatestSale(
  basketNumber: number
): Promise<{ id: string; customer_id: string | null } | null> {
  const db = liveDb();

  const sale = await db
    .from('live_sales')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sale.error) throw new Error(sale.error.message);
  if (!sale.data) return null;

  const basket = await db
    .from('baskets')
    .select('id, customer_id')
    .eq('live_sale_id', (sale.data as any).id)
    .eq('basket_number', basketNumber)
    .maybeSingle();

  if (basket.error) throw new Error(basket.error.message);
  return (basket.data as any) ?? null;
}

/**
 * Merge several baskets onto ONE order — one label, one shipment, for a
 * customer who won multiple baskets in the same live. Each basket keeps its
 * own record but points at the shared order_id; the customer's portal shows
 * them grouped under that one shipment.
 */
export async function mergeBasketsToOrder(opts: {
  basketIds: string[];
  orderId: string;
  actor?: string;
}): Promise<void> {
  const db = liveDb();

  const { error } = await db
    .from('baskets')
    .update({ order_id: opts.orderId })
    .in('id', opts.basketIds);

  if (error) throw new Error(error.message);

  for (const id of opts.basketIds) {
    await recordEvent({
      basketId: id,
      kind: 'linked_order',
      actor: opts.actor,
      detail: { order_id: opts.orderId, merged: opts.basketIds.length },
    });
  }
}
