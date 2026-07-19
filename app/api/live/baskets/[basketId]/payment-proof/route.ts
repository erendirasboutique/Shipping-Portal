// app/api/live/baskets/[basketId]/payment-proof/route.ts
//
// Returns a short-lived signed link to a customer's payment screenshot (which
// lives in a PRIVATE Supabase Storage bucket), plus the method + note they
// submitted. Called on demand from the admin, so links are fresh each time.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service-role client — bypasses Storage RLS, so no bucket policy needed.
// Server-only. Never import this into a client component.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// All three confirmed against your mark-paid route. BUCKET mirrors the same
// env fallback that route uses, so they stay in sync if you ever set it.
const BUCKET = process.env.PAYMENT_PROOFS_BUCKET || 'payment-proofs';
const PROOF_COLUMN = 'payment_proof_path';
const TABLE = 'baskets';

export async function GET(
  _req: Request,
  { params }: { params: { basketId: string } }, // sync params, matches your pages
) {
  // 🔒 This hands back a private financial screenshot. It sits at the same
  //    /api/live/baskets/[basketId]/... prefix as your existing admin PATCH,
  //    merge, and claims routes — so if those are protected by middleware,
  //    this inherits that protection automatically. Verify by hitting this URL
  //    while logged out: it should NOT return a signed link. If it does, add
  //    the same guard your other admin routes use, e.g.:
  //      const ok = await isAdmin(_req);
  //      if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { basketId } = params;

  const { data: basket, error } = await admin
    .from(TABLE)
    .select(`id, payment_method, payment_note, ${PROOF_COLUMN}`)
    .eq('id', basketId)
    .maybeSingle();

  if (error || !basket) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const path = (basket as Record<string, unknown>)[PROOF_COLUMN] as string | null;

  let url: string | null = null;
  if (path) {
    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 10); // 10-minute link
    url = signed?.signedUrl ?? null;
  }

  return NextResponse.json({
    url,
    method: basket.payment_method ?? null,
    note: basket.payment_note ?? null,
  });
}
