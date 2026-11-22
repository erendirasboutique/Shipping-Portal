// app/api/customers/[id]/portal-short-link/route.ts
// "Copy portal link" (order page and customer profile) calls this.
// Returns the customer's saved my.ebtq.io link, or makes one on Dub, saves it
// on the customer, and returns it. If Dub fails, returns the full portal link
// so the button still copies something that works.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { accountPortalUrl, createAccountShortLink } from "@/lib/portalShortLink";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin: any = supabaseAdmin();
  const { data: cust, error } = await admin
    .from("shipping_customers")
    .select("id, portal_token, account_short_url")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!cust) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  if (!cust.portal_token) return NextResponse.json({ error: "This customer has no portal link yet." }, { status: 400 });

  const longUrl = accountPortalUrl(cust.portal_token);
  if (cust.account_short_url) {
    return NextResponse.json({ url: cust.account_short_url, short: true, created: false, longUrl });
  }

  const made = await createAccountShortLink(cust.id, cust.portal_token);
  if ("error" in made) {
    return NextResponse.json({ url: longUrl, short: false, created: false, longUrl, reason: made.error });
  }

  const { error: saveErr } = await admin
    .from("shipping_customers")
    .update({ account_short_url: made.shortLink })
    .eq("id", cust.id);
  if (saveErr) console.error("[portal-short-link] couldn't save", cust.id, saveErr.message);

  return NextResponse.json({ url: made.shortLink, short: true, created: true, longUrl });
}
