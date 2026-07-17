import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client for the live sale module.
 *
 * Self-contained on purpose — it doesn't import from your existing
 * lib/supabase files so this add-on can't break them. If you'd rather
 * reuse your existing admin client, delete this file and point the
 * imports in app/api/live/** at yours instead.
 *
 * Server-only. Never import this from a "use client" file.
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
  });

  return cached;
}
