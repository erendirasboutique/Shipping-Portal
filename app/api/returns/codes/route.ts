import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let code = "EB-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const admin = supabaseAdmin();

    // Retry on the (rare) unique-code collision
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { data, error } = await admin
        .from("return_codes")
        .insert({
          code,
          customer_id: body.customer_id ?? null,
          order_id: body.order_id ?? null,
          expires_at: body.expires_at ?? null,
          created_by: user.email,
        })
        .select()
        .single();
      if (!error) return NextResponse.json({ ok: true, code: data });
      if (!error.message.includes("duplicate")) throw new Error(error.message);
    }
    throw new Error("Could not generate a unique code — try again");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
