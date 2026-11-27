// lib/equipo/data.ts
// Server-only. What the team stations (/equipo) read: one live sale's
// baskets, flattened to what a phone screen needs. Built on the live sale
// module's own queries, so the stations and the old /admin/live tools
// always show the same baskets.

import { liveDb } from "@/lib/live/supabase";
import { getBasketsForSale, getSale } from "@/lib/live/queries";
import { CUSTOMERS_TABLE } from "@/lib/live/schema";
import { autoSendStatus, openUrlFor } from "@/lib/messenger";
import type { BasketDetail } from "@/types/live";

export type EquipoBasket = {
  id: string;
  number: number;
  status: string;
  total_cents: number;
  photo_url: string | null;
  customer: { id: string; name: string; token: string | null } | null;
  /** First letter for the floor line (accents dropped), "?" without a customer. */
  letter: string;
  sent: boolean;
  paid: boolean;
  /** The customer said she paid (photo of her payment); not checked yet. */
  to_confirm: boolean;
  paid_by: string | null;
  payment_method: string | null;
  order_id: string | null;
  messenger: { auto: boolean; reason: string; openUrl: string | null } | null;
};

export function letterFor(name: string | null | undefined): string {
  const c = String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .charAt(0)
    .toUpperCase();
  return /[A-Z]/.test(c) ? c : "?";
}

export function flatten(b: BasketDetail, messenger?: any): EquipoBasket {
  const paid = b.status === "paid" || b.status === "shipped";
  const name = b.customer?.name ?? null;
  return {
    id: b.id,
    number: b.basket_number,
    status: b.status,
    total_cents: Number(b.total_cents || 0),
    photo_url: b.photo_url,
    customer: b.customer ? { id: b.customer.id, name: name || "", token: b.customer.portal_token ?? null } : null,
    letter: letterFor(name),
    sent: b.status !== "open" && b.status !== "void",
    paid,
    to_confirm: paid && b.paid_by === "customer",
    paid_by: b.paid_by,
    payment_method: b.payment_method,
    order_id: b.order_id,
    messenger: messenger || null,
  };
}

/** Messenger details per customer: can the Page send by itself, and the chat link. */
export async function messengerFor(customerIds: string[]) {
  const out = new Map<string, { auto: boolean; reason: string; openUrl: string | null; psid: string | null }>();
  if (!customerIds.length) return out;
  const { data } = await liveDb()
    .from(CUSTOMERS_TABLE)
    .select("id, messenger_link, messenger_psid, messenger_last_inbound_at")
    .in("id", customerIds);
  (data || []).forEach((c: any) => {
    const a = autoSendStatus(c);
    out.set(c.id, { auto: a.ok, reason: a.reason, openUrl: openUrlFor(c.messenger_link), psid: c.messenger_psid || null });
  });
  return out;
}

/** The sale to show: the one asked for, else the most recent one. */
export async function pickSale(saleId: string | null) {
  const db = liveDb();
  const { data: sales, error } = await db
    .from("live_sales")
    .select("id, title, sale_date, status")
    .order("sale_date", { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);
  const list = sales || [];
  const chosen = (saleId && list.find((s: any) => s.id === saleId)) || (saleId ? await getSale(saleId) : null) || list[0] || null;
  return { sale: chosen as any, sales: list as any[] };
}

export async function saleBaskets(saleId: string): Promise<EquipoBasket[]> {
  const baskets = (await getBasketsForSale(saleId)).filter((b) => b.status !== "void");
  const ids = Array.from(new Set(baskets.map((b) => b.customer_id).filter((x): x is string => Boolean(x))));
  const m = await messengerFor(ids);
  return baskets.map((b) => {
    const info = b.customer_id ? m.get(b.customer_id) : undefined;
    return flatten(b, info ? { auto: info.auto, reason: info.reason, openUrl: info.openUrl } : null);
  });
}
