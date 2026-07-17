export type LiveSaleStatus = 'draft' | 'live' | 'closed' | 'settled';

export type BasketStatus =
  | 'open'
  | 'finalized'
  | 'paid'
  | 'released'
  | 'shipped'
  | 'void';

export interface LiveSale {
  id: string;
  sale_date: string;
  title: string | null;
  status: LiveSaleStatus;
  payment_due_at: string | null;
  payment_instructions: string | null;
  payment_instructions_es: string | null;
  default_shipping_cents: number;
  created_at: string;
  updated_at: string;
}

export interface LiveItem {
  id: string;
  live_sale_id: string;
  code: string;
  description: string;
  description_es: string | null;
  price_cents: number;
  quantity: number;
  photo_url: string | null;
  sort_order: number;
  created_at: string;
}

export interface LiveItemStock {
  live_item_id: string;
  live_sale_id: string;
  code: string;
  quantity_total: number;
  quantity_claimed: number;
  quantity_remaining: number;
}

/** A catalog item joined with its live stock count. */
export type LiveItemWithStock = LiveItem & {
  quantity_claimed: number;
  quantity_remaining: number;
};

export interface Basket {
  id: string;
  live_sale_id: string;
  basket_number: number;
  customer_id: string | null;
  order_id: string | null;
  status: BasketStatus;
  shipping_cents: number;
  discount_cents: number;
  notes: string | null;
  payment_method: string | null;
  finalized_at: string | null;
  paid_at: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BasketItem {
  id: string;
  basket_id: string;
  live_item_id: string | null;
  description: string;
  description_es: string | null;
  photo_url: string | null;
  quantity: number;
  unit_price_cents: number;
  voided_at: string | null;
  created_at: string;
}

export interface BasketTotals {
  basket_id: string;
  live_sale_id: string;
  basket_number: number;
  customer_id: string | null;
  status: BasketStatus;
  shipping_cents: number;
  discount_cents: number;
  subtotal_cents: number;
  item_count: number;
  total_cents: number;
}

/** Basket + totals + items, the shape the admin and portal both read. */
export interface BasketDetail extends Basket {
  subtotal_cents: number;
  total_cents: number;
  item_count: number;
  items: BasketItem[];
  customer?: {
    id: string;
    name: string | null;
    email: string | null;
    portal_token: string | null;
  } | null;
}

/** One entry in the undo rail on the claims screen. */
export interface RecentClaim {
  id: string;
  basket_number: number;
  code: string | null;
  description: string;
  unit_price_cents: number;
  quantity: number;
  created_at: string;
}
