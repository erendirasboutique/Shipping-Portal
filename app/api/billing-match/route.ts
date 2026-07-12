import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Queries the BILLING portal's Supabase project to find a payment that
// matches a shipping order. Match priority: email -> name -> address.
// Falls through payments -> gift_cards -> payment_links.
// Requires two env vars in Vercel (server-side only, never NEXT_PUBLIC):
//   BILLING_SUPABASE_URL
//   BILLING_SUPABASE_SERVICE_ROLE_KEY

export const dynamic = "force-dynamic";

function billingClient() {
  const url = process.env.BILLING_SUPABASE_URL;
  const key = process.env.BILLING_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizePayment(row: any, source: string) {
  if (source === "payments") {
    return {
      amount: row.amount_total,
      currency: row.currency || "usd",
      status: row.payment_status,
      refund_status: row.refund_status,
      method: row.payment_method,
      method_brand: row.payment_method_brand,
      method_last4: row.payment_method_last4,
      payment_source: row.payment_source,
      receipt_url: row.receipt_url,
      description: row.description,
      created_at: row.created_at,
    };
  }
  if (source === "gift_cards") {
    return {
      amount: row.amount,
      currency: "usd",
      status: row.status,
      refund_status: null,
      method: "Gift card",
      method_brand: null,
      method_last4: null,
      payment_source: "gift_card",
      receipt_url: row.gift_card_url || row.pdf_url,
      description: "Gift card " + (row.code || ""),
      created_at: row.created_at,
    };
  }
  return {
    amount: row.amount,
    currency: "usd",
    status: row.status,
    refund_status: null,
    method: "Payment link",
    method_brand: null,
    method_last4: null,
    payment_source: "payment_link",
    receipt_url: row.url,
    description: row.title || row.description,
    created_at: row.created_at,
  };
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email || "").trim();
  const name = (body.name || "").trim();
  const street1 = (body.street1 || "").trim();
  const zip = (body.zip || "").trim();

  const billing = billingClient();
  if (!billing) {
    return NextResponse.json({
      matched: false,
      reason: "billing_not_configured",
    });
  }

  let match: any = null;
  let matchedBy: string | null = null;
  let source: string | null = null;

  try {
    // ---- 1. payments by email ----
    if (email) {
      const { data } = await billing
        .from("payments")
        .select("*")
        .ilike("customer_email", email)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length) {
        match = data[0];
        matchedBy = "email";
        source = "payments";
      }
    }

    // ---- 2. payments by name ----
    if (!match && name) {
      const { data } = await billing
        .from("payments")
        .select("*")
        .ilike("customer_name", name)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length) {
        match = data[0];
        matchedBy = "name";
        source = "payments";
      }
    }

    // ---- 3. payments by shipping address (zip, then street check) ----
    if (!match && zip) {
      const { data } = await billing
        .from("payments")
        .select("*")
        .eq("shipping_address->>postal_code", zip)
        .order("created_at", { ascending: false })
        .limit(25);
      if (data && data.length) {
        const streetLower = street1.toLowerCase();
        const hit = data.find(function (p: any) {
          const line1 = ((p.shipping_address || {}).line1 || "").toLowerCase();
          if (!streetLower) return true;
          return line1 && (line1.includes(streetLower) || streetLower.includes(line1));
        });
        if (hit) {
          match = hit;
          matchedBy = "address";
          source = "payments";
        }
      }
    }

    // ---- 4. gift_cards by email, then name ----
    if (!match && email) {
      const { data } = await billing
        .from("gift_cards")
        .select("*")
        .ilike("customer_email", email)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length) {
        match = data[0];
        matchedBy = "email";
        source = "gift_cards";
      }
    }
    if (!match && name) {
      const { data } = await billing
        .from("gift_cards")
        .select("*")
        .ilike("customer_name", name)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length) {
        match = data[0];
        matchedBy = "name";
        source = "gift_cards";
      }
    }

    // ---- 5. payment_links by email, then name ----
    if (!match && email) {
      const { data } = await billing
        .from("payment_links")
        .select("*")
        .ilike("customer_email", email)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length) {
        match = data[0];
        matchedBy = "email";
        source = "payment_links";
      }
    }
    if (!match && name) {
      const { data } = await billing
        .from("payment_links")
        .select("*")
        .ilike("customer_name", name)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length) {
        match = data[0];
        matchedBy = "name";
        source = "payment_links";
      }
    }

    // ---- Lifetime spend from billing payments ----
    let lifetime = { payments_count: 0, total_spend: 0 };
    if (matchedBy === "email" || (email && match)) {
      const { data } = await billing
        .from("payments")
        .select("amount_total, refund_status")
        .ilike("customer_email", email || match.customer_email || "");
      if (data) {
        lifetime.payments_count = data.length;
        lifetime.total_spend = data.reduce(function (sum: number, p: any) {
          if (p.refund_status) return sum;
          return sum + Number(p.amount_total || 0);
        }, 0);
      }
    } else if (match && match.customer_name) {
      const { data } = await billing
        .from("payments")
        .select("amount_total, refund_status")
        .ilike("customer_name", match.customer_name);
      if (data) {
        lifetime.payments_count = data.length;
        lifetime.total_spend = data.reduce(function (sum: number, p: any) {
          if (p.refund_status) return sum;
          return sum + Number(p.amount_total || 0);
        }, 0);
      }
    }

    if (!match) {
      return NextResponse.json({ matched: false, lifetime });
    }

    return NextResponse.json({
      matched: true,
      matchedBy,
      source,
      payment: normalizePayment(match, source as string),
      lifetime,
    });
  } catch (e: any) {
    return NextResponse.json(
      { matched: false, error: e.message },
      { status: 500 }
    );
  }
}
