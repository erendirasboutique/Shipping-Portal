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
  { auth: { persistSession: false } },
);

// ── Confirm these two against your mark-paid route ──────────────────────────
// In app/api/live/portal/[token]/baskets/[basketId]/mark-paid/route.ts, look
// for `.storage.from('…').upload(` → that string is your BUCKET, and the
// column your `.update({ … })` writes the returned path to is PROOF_COLUMN.
const BUCKET = 'payment-proofs';
const PROOF_COLUMN = 'payment_proof_path';
const TABLE = 'live_baskets'; // ← confirm your baskets table name

export async function GET(
  _req: Request,
  { params }: { params: { basketId: string } }, // sync params, matches your pages
) {
  // 🔒 This hands back a private financial screenshot. Gate it behind the SAME
  //    admin auth the rest of your /api/live admin routes use — if an
  //    unauthenticated request reaches this, anyone can read the signed link.
  //    e.g.  const ok = await isAdmin(_req); if (!ok) return NextResponse.json(
  //            { error: 'Unauthorized' }, { status: 401 });

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
