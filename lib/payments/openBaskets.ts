// lib/payments/openBaskets.ts
// Baskets still waiting for payment, from recent live sales, with their
// total and customer name. What a forwarded payment gets matched against.

import { liveDb } from "@/lib/live/supabase";
import { CUSTOMERS_TABLE, CUSTOMER_COLS } from "@/lib/live/schema";
import type { OpenBasket } from "@/lib/payments/inbound";

const DAYS_BACK = 21;

export async function getOpenBaskets(): Promise<OpenBasket[]> {
  const db = liveDb();
  const since = new Date(Date.now() - DAYS_BACK * 86400000).toISOString().slice(0, 10);

  const { data: sales, error: salesErr } = await db
    .from("live_sales")
    .select("id, title, sale_date")
    .gte("sale_date", since)
    .order("sale_date", { ascending: false });
  if (salesErr) throw new Error(salesErr.message);
  if (!sales?.length) return [];

  const saleById = new Map<string, any>(sales.map((s: any) => [s.id, s]));
  const { data: totals, error: totErr } = await db
    .from("basket_totals")
    .select("basket_id, live_sale_id, basket_number, customer_id, status, total_cents")
    .in("live_sale_id", sales.map((s: any) => s.id))
    .in("status", ["open", "finalized"]);
  if (totErr) throw new Error(totErr.message);

  const rows = (totals || []) as any[];
  const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean)));
  const names = new Map<string, string>();
  if (customerIds.length) {
    const { data: customers, error } = await db
      .from(CUSTOMERS_TABLE)
      .select(`${CUSTOMER_COLS.id}, ${CUSTOMER_COLS.name}`)
      .in(CUSTOMER_COLS.id, customerIds);
    if (error) throw new Error(error.message);
    (customers || []).forEach((c: any) => names.set(c[CUSTOMER_COLS.id], c[CUSTOMER_COLS.name]));
  }

  return rows
    .map((r) => {
      const sale = saleById.get(r.live_sale_id) || {};
      return {
        id: r.basket_id,
        basket_number: r.basket_number,
        total_cents: Number(r.total_cents || 0),
        customer_name: r.customer_id ? names.get(r.customer_id) || null : null,
        sale_title: sale.title || null,
        sale_date: sale.sale_date || null,
        status: r.status,
      } as OpenBasket;
    })
    .sort((a, b) => (b.sale_date || "").localeCompare(a.sale_date || "") || a.basket_number - b.basket_number);
}
