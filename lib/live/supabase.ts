import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client for the live sale module.
 *
 * Self-contained on purpose — it doesn't import your existing supabase
 * files, so this add-on can't break them.
 *
 * Server-only. Never import this from a 'use client' file.
 */

let cached: SupabaseClient | null = null;

export function liveDb(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Live sale module needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. ' +
        'Add them in Vercel → Settings → Environment Variables.'
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      /**
       * THIS LINE IS LEAD, NOT GOLD PLATING. Don't remove it.
       *
       * Next 14's App Router patches global fetch and caches GET requests
       * by default. supabase-js runs every query through fetch — so every
       * read from this client was being served out of Next's Data Cache,
       * indefinitely, keyed by URL.
       *
       * What that looked like in practice: a sale created and the list
       * still saying "No sales yet". An item added and gone three seconds
       * later. A customer assigned, saved to the row, and absent on
       * refresh. And the strangest one — `.order('basket_number')`
       * returning zero rows with no error, while the identical query
       * without .order() returned three. Different query string, different
       * cache key: that one had been cached when the sale had no baskets,
       * and it stayed empty forever.
       *
       * `export const dynamic = 'force-dynamic'` does NOT cover this. That
       * governs route rendering, not the fetch cache underneath it.
       *
       * A live sale screen must never show a cached number. It's the whole
       * point of the screen.
       */
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: 'no-store' }),
    },
  });

  return cached;
}

/**
 * supabase-js works out a row's type by parsing the select string at
 * compile time. Our selects are built from the constants in schema.ts, so
 * at type level they're plain `string` — the parser can't read them and
 * hands back `GenericStringError` instead of a row shape.
 *
 * The data is correct at runtime; TypeScript just can't see it. These
 * take `unknown`, so they compile no matter what supabase infers, and
 * they keep the cast in one file instead of scattering `as unknown as`
 * through the query layer.
 */
export function asRow<T>(data: unknown): T | null {
  return (data ?? null) as T | null;
}

export function asRows<T>(data: unknown): T[] {
  return (data ?? []) as T[];
}
