import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client for the live sale module.
 *
 * Self-contained on purpose — it doesn't import your existing supabase
 * files, so this add-on can't break them. If you'd rather reuse your
 * existing admin client, delete this file and point the imports in
 * app/api/live/** at yours instead.
 *
 * Server-only. Never import this from a 'use client' file.
 *
 * ── Why the return type is `any` ──────────────────────────────────────
 * supabase-js parses .select() strings at the TYPE level, which only
 * works when the string is a literal. This module builds its select
 * strings from the constants in schema.ts (so a column rename is a
 * one-line edit), which makes them plain `string` — and the parser then
 * hands back `GenericStringError` instead of your row type.
 *
 * Rather than sprinkle `as unknown as X` at every call site, the client
 * is untyped here and results are cast to the real types from
 * types/live.ts immediately after. Those types are what the rest of the
 * module actually checks against.
 *
 * You lose supabase's column-name autocomplete inside this module. You'd
 * have lost it anyway — it needs a generated Database generic, which
 * this project doesn't have.
 */

let cached: SupabaseClient | null = null;

export function liveDb(): any {
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
 *
 * Only needed for selects built from constants. A literal select string
 * like .select('*') types itself correctly and shouldn't use these.
 */
export function asRow<T>(data: unknown): T | null {
  return (data ?? null) as T | null;
}

export function asRows<T>(data: unknown): T[] {
  return (data ?? []) as T[];
}
