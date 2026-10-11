// lib/liveList.ts
// Shared helpers for the Live List (app/live-list): weekly numbering and
// the staff check every route uses.

import { supabaseServer } from "@/lib/supabase/server";

export type LiveListRow = {
  id: string;
  week_start: string;
  number: number;
  name: string;
  order_id: string | null;
  created_at: string;
  order?: {
    id: string;
    order_number: number | null;
    tracking_number: string | null;
    label_url: string | null;
    status: string | null;
  } | null;
};

/** Columns read for a row, with the linked shipping order. */
export const LIVE_LIST_SELECT =
  "id, week_start, number, name, order_id, created_at, order:shipping_orders(id, order_number, tracking_number, label_url, status)";

/**
 * The Sunday that starts the current week, in Pacific time, as YYYY-MM-DD.
 * Friday's list and Saturday's label-buying always land in the same week,
 * and numbers restart at #1 on their own every Sunday.
 */
export function currentWeekStart(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const d = new Date(Date.UTC(+get("year"), +get("month") - 1, +get("day")));
  d.setUTCDate(d.getUTCDate() - Math.max(days, 0));
  return d.toISOString().slice(0, 10);
}

/** Staff check, same as the rest of the portal's API routes. */
export async function staffUser() {
  const {
    data: { user },
  } = await supabaseServer().auth.getUser();
  return user;
}

/** "EB-1042" style order number, or null. */
export function ebNumber(n: number | null | undefined): string | null {
  return typeof n === "number" ? `EB-${n}` : null;
}
