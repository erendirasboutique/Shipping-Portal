import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getBasketsForPortalToken } from '@/lib/live/queries';
import { isUuid } from '@/lib/live/schema';

export const dynamic = 'force-dynamic';

const ALLOWED_METHODS = new Set([
  'zelle',
  'cash_app',
  'venmo',
  'paypal',
  'apple_pay',
  'other',
]);

const MAX_FILE_SIZE = 8 * 1024 * 1024;

// ── Confirm this matches the table your /timeline route reads from ──────────
// Open app/api/live/baskets/[basketId]/timeline/route.ts (or @/lib/live/timeline)
// and check the table its .insert()/.select() uses. Everything else about the
// row shape (kind, detail, actor) is already correct — this is the one name to
// verify. If it's wrong the payment still succeeds; only the log is skipped.
const EVENTS_TABLE = 'basket_events';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL.');
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function extensionFor(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension && ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(extension)) {
    return extension;
  }

  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/heic') return 'heic';

  return 'jpg';
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params:
      | Promise<{ token: string; basketId: string }>
      | { token: string; basketId: string };
  },
) {
  let uploadedPath: string | null = null;

  try {
    const { token, basketId } = await params;

    if (!isUuid(token) || !isUuid(basketId)) {
      return NextResponse.json({ error: 'Invalid basket link.' }, { status: 400 });
    }

    const baskets = await getBasketsForPortalToken(token);
    const basket = baskets.find((item) => item.id === basketId);

    if (!basket) {
      return NextResponse.json({ error: 'Basket not found.' }, { status: 404 });
    }

    if (basket.status === 'paid' || basket.status === 'shipped') {
      return NextResponse.json({ ok: true, alreadyPaid: true });
    }

    if (basket.status !== 'finalized') {
      return NextResponse.json(
        { error: `This basket cannot be reported paid while its status is "${basket.status}".` },
        { status: 409 },
      );
    }

    const formData = await request.formData();
    const method = String(formData.get('paymentMethod') || '').trim();
    const proof = formData.get('paymentProof');

    if (!ALLOWED_METHODS.has(method)) {
      return NextResponse.json(
        { error: 'Please select how you paid.' },
        { status: 400 },
      );
    }

    if (!(proof instanceof File) || proof.size === 0) {
      return NextResponse.json(
        { error: 'Please upload your payment confirmation image.' },
        { status: 400 },
      );
    }

    if (!proof.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'The payment confirmation must be an image.' },
        { status: 400 },
      );
    }

    if (proof.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'The image must be smaller than 8 MB.' },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const bucket = process.env.PAYMENT_PROOFS_BUCKET || 'payment-proofs';
    const extension = extensionFor(proof);

    uploadedPath = `${basketId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const bytes = new Uint8Array(await proof.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(uploadedPath, bytes, {
        contentType: proof.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Payment proof upload failed:', uploadError);

      return NextResponse.json(
        { error: `Could not upload confirmation: ${uploadError.message}` },
        { status: 500 },
      );
    }

    const paidAt = new Date().toISOString();

    const { data, error: updateError } = await supabase
      .from('baskets')
      .update({
        status: 'paid',
        paid_at: paidAt,
        payment_method: method,
        payment_proof_path: uploadedPath,
        // Was never set on the customer path, so these payments showed blank
        // in the drawer's "who did what". Marks it as a self-report.
        paid_by: 'customer',
      })
      .eq('id', basketId)
      .eq('status', 'finalized')
      .select('id, status, paid_at, payment_method, payment_proof_path')
      .maybeSingle();

    if (updateError || !data) {
      if (uploadedPath) {
        await supabase.storage.from(bucket).remove([uploadedPath]);
      }

      console.error('Basket payment update failed:', updateError);

      return NextResponse.json(
        {
          error: updateError
            ? `Could not update basket: ${updateError.message}`
            : 'No basket was updated.',
        },
        { status: 500 },
      );
    }

    // Log to the basket's timeline. This is what was missing — the update
    // above flipped the basket to paid, but nothing recorded it in history, so
    // customer payments never appeared in the timeline. Wrapped on its own so a
    // logging hiccup can't undo a payment that already went through.
    try {
      await supabase.from(EVENTS_TABLE).insert({
        basket_id: basketId,
        kind: 'paid',
        detail: { method, source: 'customer_portal' },
        actor: 'customer',
      });
    } catch (logError) {
      console.error('Timeline log (paid) failed:', logError);
    }

    return NextResponse.json({
      ok: true,
      basket: data,
    });
  } catch (error) {
    console.error('Customer payment confirmation failed:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not submit payment confirmation.',
      },
      { status: 500 },
    );
  }
}
