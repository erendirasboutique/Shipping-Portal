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
  /** When true, this sale uses quick mode: type a total instead of items. */
  quick_mode: boolean;
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

/** The shipping_orders row a paid basket turns into. */
export interface LinkedOrder {
  id: string;
  order_number: number | null;
  status: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier: string | null;
}

/** A customer row as selected by CUSTOMER_SELECT in lib/live/schema.ts. */
export interface CustomerRow {
  id: string;
  name: string | null;
  email: string | null;
  portal_token: string | null;
}

/** A customer row as selected by CUSTOMER_ADDRESS_SELECT — used to build an order. */
export interface CustomerAddressRow extends CustomerRow {
  phone: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

export interface Basket {
  id: string;
  live_sale_id: string;
  basket_number: number;
  customer_id: string | null;
  order_id: string | null;
  status: BasketStatus;
  shipping_cents: number;
  discount_cents: number;
  /**
   * Quick mode: a manually-typed all-in total. When set, the basket's total
   * is this minus discount, and items are ignored. When null, the total is
   * computed from items the normal way.
   */
  manual_total_cents: number | null;
  notes: string | null;
  /** Photo of the physical basket, sent with their total. */
  photo_url: string | null;
  /** Shown on the customer's order page once you ship. */
  tracking_number: string | null;
  carrier: string | null;
  /** Operator names — free text, set from the header, not from auth. */
  created_by: string | null;
  finalized_by: string | null;
  paid_by: string | null;
  released_by: string | null;
  /** How they paid. Set by staff, never automatically. */
  payment_method: string | null;
  /** Free text — Zelle confirmation number, "paid at the shop", etc. */
  payment_note: string | null;
  /**
   * A Stripe link pasted in from the billing portal's generator, for the
   * occasional card payer. This module never creates one itself.
   */
  stripe_payment_link_id: string | null;
  stripe_payment_link_url: string | null;
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
  created_by: string | null;
  voided_by: string | null;
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
  customer?: CustomerRow | null;
  /** Present once the basket has been paid and an order minted. */
  order?: LinkedOrder | null;
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
