// app/api/equipo/clienta/route.ts
// Staff only. POST { name, phone?, messenger_link? }: add a new customer
// straight from the Thursday station, so a first-time buyer doesn't have
// to be typed into Customers first. If someone with exactly that name (or
// that phone) already exists, that customer is returned instead of a copy.

import crypto from "crypto";
import { NextResponse } from "next/server";
import { staffUser } from "@/lib/liveList";
import { liveDb } from "@/lib/live/supabase";
import { CUSTOMERS_TABLE } from "@/lib/live/schema";
import { parseMessengerLink } from "@/lib/messenger";

export const dynamic = "force-dynamic";

function digits(s: string) {
  return s.replace(/\D/g, "");
}

export async function POST(req: Request) {
  const user = await staffUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const phone = String(body.phone || "").trim().slice(0, 40);
    const link = String(body.messenger_link || "").trim();
    if (name.length < 2) return NextResponse.json({ error: "Escribe su nombre" }, { status: 400 });

    const db = liveDb();

    // Already there? Same name (any capitalization) or same phone.
    const { data: sameName } = await db
      .from(CUSTOMERS_TABLE)
      .select("id, name, phone, email")
      .ilike("name", name.replace(/[\\%_]/g, (c) => "\\" + c))
      .is("merged_into", null)
      .not("archived", "is", true)
      .limit(1);
    if (sameName && sameName.length) return NextResponse.json({ customer: sameName[0], existed: true });

    if (digits(phone).length >= 10) {
      const last10 = digits(phone).slice(-10);
      const { data: byPhone } = await db
        .from(CUSTOMERS_TABLE)
        .select("id, name, phone, email")
        .ilike("phone", "%" + last10.slice(-4) + "%")
        .is("merged_into", null)
        .limit(20);
      const hit = (byPhone || []).find((c: any) => digits(String(c.phone || "")).slice(-10) === last10);
      if (hit) return NextResponse.json({ customer: hit, existed: true });
    }

    const row: Record<string, unknown> = { name, portal_token: crypto.randomUUID() };
    if (phone) row.phone = phone;
    if (link) {
      const parsed = parseMessengerLink(link);
      if ("link" in parsed) row.messenger_link = parsed.link;
    }

    const { data, error } = await db.from(CUSTOMERS_TABLE).insert(row).select("id, name, phone, email").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ customer: data, existed: false }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
