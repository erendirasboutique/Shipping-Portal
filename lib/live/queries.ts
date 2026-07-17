import { asRow, liveDb } from './supabase';
import {
  CUSTOMERS_TABLE,
  CUSTOMER_COLS,
  CUSTOMER_SELECT,
  ORDERS_TABLE,
  isUuid,
} from './schema';
import type {
  Basket,
  CustomerRow,
  LinkedOrder,
  LiveItem,
  BasketDetail,
  BasketItem,
  BasketTotals,
  LiveItemWithStock,
  LiveSale,
  RecentClaim,
} from '@/types/live';

export async function listSales(): Promise<LiveSale[]> {
  const { data, error } = await liveDb()
    .from('live_sales')
    .select('*')
    .order('sale_date', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as LiveSale[];
}

export async function getSale(saleId: string): Promise<LiveSale | null> {
  const { data, error } = await liveDb()
    .from('live_sales')
    .select('*')
    .eq('id', saleId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as LiveSale) ?? null;
}

export async function getCatalog(saleId: string): Promise<LiveItemWithStock[]> {
  const db = liveDb();

  const [items, stock] = await Promise.all([
    db
      .from('live_items')
      .select('*')
      .eq('live_sale_id', saleId)
      .order('sort_order', { ascending: true })
      .order('code', { ascending: true }),
    db.from('live_item_stock').select('*').eq('live_sale_id', saleId),
  ]);

  if (items.error) throw new Error(items.error.message);
  if (stock.error) throw new Error(stock.error.message);

  const stockByItem = new Map<string, any>(
    (stock.data ?? []).map((s: any) => [s.live_item_id as string, s])
  );

  // `item` is annotated because the supabase client here is untyped, so
  // items.data is `any` — and calling .map on `any` gives the callback an
  // implicit any, which strict mode rejects.
  return (items.data ?? []).map((item: LiveItem) => {
    const s = stockByItem.get(item.id);
    return {
      ...item,
      quantity_claimed: s?.quantity_claimed ?? 0,
      quantity_remaining: s?.quantity_remaining ?? item.quantity,
    } as LiveItemWithStock;
  });
}

export async function getBasketTotals(saleId: string): Promise<BasketTotals[]> {
  const { data, error } = await liveDb()
    .from('basket_totals')
    .select('*')
    .eq('live_sale_id', saleId)
    .order('basket_number', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as BasketTotals[];
}

/**
 * Finds basket N in this sale, creating it if the number hasn't been
 * used yet. Race-safe: two fast claims for the same new basket won't
 * create duplicates, because of the (live_sale_id, basket_number) unique index.
 */
export async function ensureBasket(
  saleId: string,
  basketNumber: number,
  createdBy: string | null = null
): Promise<Basket> {
  const db = liveDb();

  const existing = await db
    .from('baskets')
    .select('*')
    .eq('live_sale_id', saleId)
    .eq('basket_number', basketNumber)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data as Basket;

  const sale = await getSale(saleId);

  const created = await db
    .from('baskets')
    .insert({
      live_sale_id: saleId,
      basket_number: basketNumber,
      shipping_cents: sale?.default_shipping_cents ?? 0,
      created_by: createdBy,
    })
    .select('*')
    .single();

  if (created.error) {
    // Lost the race — someone else just created it. Read it back.
    const retry = await db
      .from('baskets')
      .select('*')
      .eq('live_sale_id', saleId)
      .eq('basket_number', basketNumber)
      .single();

    if (retry.error) throw new Error(created.error.message);
    return retry.data as Basket;
  }

  return created.data as Basket;
}

/** The undo rail on the claims screen. */
export async function getRecentClaims(
  saleId: string,
  limit = 8
): Promise<RecentClaim[]> {
  const { data, error } = await liveDb()
    .from('basket_items')
    .select(
      `id, description, unit_price_cents, quantity, created_at,
       baskets!inner ( basket_number, live_sale_id ),
       live_items ( code )`
    )
    .eq('baskets.live_sale_id', saleId)
    .is('voided_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    basket_number: row.baskets.basket_number,
    code: row.live_items?.code ?? null,
    description: row.description,
    unit_price_cents: row.unit_price_cents,
    quantity: row.quantity,
    created_at: row.created_at,
  }));
}

export async function getBasketDetail(
  basketId: string
): Promise<BasketDetail | null> {
  const db = liveDb();

  const [basket, totals, items] = await Promise.all([
    db.from('baskets').select('*').eq('id', basketId).maybeSingle(),
    db.from('basket_totals').select('*').eq('basket_id', basketId).maybeSingle(),
    db
      .from('basket_items')
      .select('*')
      .eq('basket_id', basketId)
      .is('voided_at', null)
      .order('created_at', { ascending: true }),
  ]);

  if (basket.error) throw new Error(basket.error.message);
  if (!basket.data) return null;
  if (items.error) throw new Error(items.error.message);

  const detail: BasketDetail = {
    ...(basket.data as Basket),
    subtotal_cents: totals.data?.subtotal_cents ?? 0,
    total_cents: totals.data?.total_cents ?? 0,
    item_count: totals.data?.item_count ?? 0,
    items: (items.data ?? []) as BasketItem[],
    customer: null,
  };

  if (basket.data.customer_id) {
    const c = await db
      .from(CUSTOMERS_TABLE)
      .select(CUSTOMER_SELECT)
      .eq(CUSTOMER_COLS.id, basket.data.customer_id)
      .maybeSingle();

    if (!c.error) detail.customer = asRow<CustomerRow>(c.data);
  }

  // The linked order carries the real tracking number — EasyPost writes it
  // there when you buy the label on Saturday. Reading it here means nobody
  // retypes a tracking number, and it can't be typo'd on basket 83.
  if (basket.data.order_id) {
    const o = await db
      .from(ORDERS_TABLE)
      .select('id, order_number, status, tracking_number, tracking_url, carrier')
      .eq('id', basket.data.order_id)
      .maybeSingle();

    if (!o.error) detail.order = asRow<LinkedOrder>(o.data);
  }

  return detail;
}

/** Every basket for one customer's portal token, newest sale first. */
export async function getBasketsForPortalToken(
  token: string
): Promise<BasketDetail[]> {
  // portal_token is a uuid column — a malformed token would make
  // Postgres throw rather than return nothing.
  if (!isUuid(token)) return [];

  const db = liveDb();

  const found = await db
    .from(CUSTOMERS_TABLE)
    .select(CUSTOMER_SELECT)
    .eq(CUSTOMER_COLS.portalToken, token)
    .maybeSingle();

  if (found.error) return [];

  const customer = asRow<CustomerRow>(found.data);
  if (!customer) return [];

  const baskets = await db
    .from('baskets')
    .select('*')
    .eq('customer_id', customer.id)
    .not('status', 'in', '("void")')
    .order('created_at', { ascending: false })
    .limit(10);

  if (baskets.error || !baskets.data?.length) return [];

  const details = await Promise.all(
    baskets.data.map((b: Basket) => getBasketDetail(b.id))
  );

  return details.filter((d): d is BasketDetail => d !== null);
}
