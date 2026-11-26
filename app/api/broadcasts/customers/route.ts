// app/api/broadcasts/customers/route.ts
// Staff only. ?q= name, email or phone -> up to 8 customers, for "One customer…".
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { toE164 } from "@/lib/customerNotify";
import { staff } from "@/lib/broadcastApi";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") || "").trim().replace(/[%,()]/g, " ").slice(0, 60);
  if (q.length < 2) return NextResponse.json({ customers: [] });
  const admin: any = supabaseAdmin();
  const digits = q.replace(/\D/g, "");
  const ors = [`name.ilike.%${q}%`, `email.ilike.%${q}%`];
  if (digits.length >= 4) ors.push(`phone.ilike.%${digits.slice(-4)}%`);
  const { data } = await admin
    .from("shipping_customers")
    .select("id, name, email, phone, archived, merged_into")
    .or(ors.join(","))
    .limit(20);
  const rows = (data || []).filter((c: any) => !c.archived && !c.merged_into).slice(0, 8);
  const phones = rows.map((c: any) => toE164(c.phone)).filter(Boolean);
  const subs = new Set<string>();
  if (phones.length) {
    const { data: s } = await admin.from("sms_subscribers").select("phone").in("phone", phones).is("opted_out_at", null);
    for (const r of s || []) subs.add(r.phone);
  }
  return NextResponse.json({
    customers: rows.map((c: any) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, textsOk: !!(toE164(c.phone) && subs.has(toE164(c.phone) as string)) })),
  });
}
