import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getBasketsForPortalToken } from '@/lib/live/queries';
import { isUuid } from '@/lib/live/schema';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in Vercel.');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === 'object') {
    const value = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return [
      value.message,
      value.details,
      value.hint,
      value.code ? `Code: ${value.code}` : null,
    ]
      .filter(Boolean)
      .join(' — ');
  }

  return 'Unknown server error.';
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
        { error: 'Invalid basket link or basket ID.' },
        { status: 400 },
      );
    }

    const baskets = await getBasketsForPortalToken(token);
    const basket = baskets.find((item) => item.id === basketId);

    if (!basket) {
      return NextResponse.json(
        {
          error:
            'The basket was not found for this customer portal token.',
        },
        { status: 404 },
      );
    }

    if (basket.status === 'paid' || basket.status === 'shipped') {
      return NextResponse.json({
        ok: true,
        alreadyPaid: true,
        status: basket.status,
      });
    }

    if (basket.status !== 'finalized') {
      return NextResponse.json(
        {
          error: `This basket has status "${basket.status}", not "finalized".`,
        },
        { status: 409 },
      );
    }

    const supabase = getAdminClient();

    // Change this environment variable in Vercel if your real table
    // is not named live_baskets.
    const tableName =
      process.env.LIVE_BASKETS_TABLE || 'live_baskets';

    const paidAt = new Date().toISOString();

    const { data, error } = await supabase
      .from(tableName)
      .update({
        status: 'paid',
        paid_at: paidAt,
      })
      .eq('id', basketId)
      .select('id, status, paid_at')
      .maybeSingle();

    if (error) {
      const message = errorMessage(error);

      console.error('Customer mark-paid Supabase error:', {
        tableName,
        basketId,
        message,
        error,
      });

      return NextResponse.json(
        {
          error: `Supabase update failed: ${message}`,
          table: tableName,
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            `No row was updated in "${tableName}". The basket ID may be in a different table.`,
          table: tableName,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      basket: data,
    });
  } catch (error) {
    const message = errorMessage(error);

    console.error('Customer mark-paid route error:', error);

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
