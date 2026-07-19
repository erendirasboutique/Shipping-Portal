import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getBasketsForPortalToken } from '@/lib/live/queries';
import { isUuid } from '@/lib/live/schema';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server environment variables are missing.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(
  _request: Request,
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
        { error: 'Invalid basket link.' },
        { status: 400 },
      );
    }

    // The public token is the credential. Never trust only the basket ID:
    // confirm this exact basket belongs to this exact portal token first.
    const baskets = await getBasketsForPortalToken(token);
    const basket = baskets.find((item) => item.id === basketId);

    if (!basket) {
      return NextResponse.json(
        { error: 'Basket not found for this portal link.' },
        { status: 404 },
      );
    }

    if (basket.status === 'paid' || basket.status === 'shipped') {
      return NextResponse.json({
        ok: true,
        status: basket.status,
        alreadyPaid: true,
      });
    }

    if (basket.status !== 'finalized') {
      return NextResponse.json(
        { error: 'This basket is not ready to be marked as paid.' },
        { status: 409 },
      );
    }

    const supabase = getAdminClient();
    const paidAt = new Date().toISOString();

    const { data, error } = await supabase
      .from('live_baskets')
      .update({
        status: 'paid',
        paid_at: paidAt,
      })
      .eq('id', basketId)
      .eq('status', 'finalized')
      .select('id, status, paid_at')
      .maybeSingle();

    if (error) {
      console.error('Customer mark-paid update failed:', error);
      return NextResponse.json(
        { error: 'Could not mark the basket as paid.' },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'The basket changed before it could be updated.' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      basket: data,
    });
  } catch (error) {
    console.error('Customer mark-paid route failed:', error);

    return NextResponse.json(
      { error: 'Could not mark the basket as paid.' },
      { status: 500 },
    );
  }
}
