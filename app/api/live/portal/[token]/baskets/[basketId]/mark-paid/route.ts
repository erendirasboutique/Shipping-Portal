import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getBasketsForPortalToken } from '@/lib/live/queries';
import { isUuid } from '@/lib/live/schema';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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
  try {
    const { token, basketId } = await params;

    if (!isUuid(token) || !isUuid(basketId)) {
      return NextResponse.json(
        { error: 'Invalid basket.' },
        { status: 400 },
      );
    }

    // Make sure this basket belongs to this customer's portal link
    const baskets = await getBasketsForPortalToken(token);
    const basket = baskets.find((b) => b.id === basketId);

    if (!basket) {
      return NextResponse.json(
        { error: 'Basket not found.' },
        { status: 404 },
      );
    }

    // Already paid
    if (basket.status === 'paid' || basket.status === 'shipped') {
      return NextResponse.json({
        ok: true,
        alreadyPaid: true,
      });
    }

    // Only finalized baskets can be marked paid
    if (basket.status !== 'finalized') {
      return NextResponse.json(
        {
          error: `Basket status is "${basket.status}", expected "finalized".`,
        },
        { status: 409 },
      );
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('baskets')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', basketId)
      .select()
      .single();

    if (error) {
      console.error(error);

      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      basket: data,
    });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        error: err.message ?? 'Unknown error',
      },
      { status: 500 },
    );
  }
}
