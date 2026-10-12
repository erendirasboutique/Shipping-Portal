// app/api/customers/[id]/messenger/route.ts
// Staff only. A customer's Messenger link.
//   GET   → their saved chat link, Page chat link, and (if they aren't linked
//           to a Page chat yet) recent people who messaged the Page to pick from
//   PATCH {link?: string | null, psid?: string | null}
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseMessengerLink, openUrlFor, messengerConfigured, inWindow } from "@/lib/messenger";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function staff() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  return user;
}

function needsSql(msg: string) {
  return /messenger_/i.test(msg)
    ? "Messenger linking needs a database update. Run supabase/messenger_link.sql in Supabase."
    : msg;
}

async function load(admin: any, id: string) {
  const { data, error } = await admin
    .from("shipping_customers")
    .select("id, name, messenger_link, messenger_psid, messenger_last_inbound_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(needsSql(error.message));
  return data;
}

function shape(c: any, contacts: any[] = []) {
  return {
    link: c.messenger_link || null,
    openUrl: openUrlFor(c.messenger_link),
    pageLinked: !!c.messenger_psid,
    autoReady: messengerConfigured() && !!c.messenger_psid && inWindow(c.messenger_last_inbound_at),
    lastMessagedAt: c.messenger_last_inbound_at || null,
    pageEnabled: messengerConfigured(),
    contacts,
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!UUID.test(params.id)) return NextResponse.json({ error: "Not a customer." }, { status: 400 });
  try {
    const admin: any = supabaseAdmin();
    const c = await load(admin, params.id);
    if (!c) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

    // People who messaged the Page and aren't linked to anyone yet,
    // closest name first, so the right one is usually on top.
    let contacts: any[] = [];
    if (!c.messenger_psid && messengerConfigured()) {
      const { data } = await admin
        .from("messenger_contacts")
        .select("psid, name, last_inbound_at")
        .is("customer_id", null)
        .order("last_inbound_at", { ascending: false })
        .limit(40);
      const words = String(c.name || "").toLowerCase().split(/\s+/).filter((w) => w.length > 1);
      type Row = { psid: string; name: string | null; last_inbound_at: string | null; score: number };
      const rows: any[] = data || [];
      const scored: Row[] = rows.map((x: any) => {
        const n = String(x.name || "").toLowerCase();
        return { psid: x.psid, name: x.name, last_inbound_at: x.last_inbound_at, score: words.filter((w) => n.includes(w)).length };
      });
      contacts = scored
        .sort((a: Row, b: Row) => b.score - a.score)
        .slice(0, 6)
        .map((r: Row) => ({ psid: r.psid, name: r.name, lastMessagedAt: r.last_inbound_at, likely: r.score > 0 }));
    }
    return NextResponse.json(shape(c, contacts));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Couldn't load." }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!UUID.test(params.id)) return NextResponse.json({ error: "Not a customer." }, { status: 400 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  try {
    const admin: any = supabaseAdmin();
    const c = await load(admin, params.id);
    if (!c) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    const update: any = { updated_at: new Date().toISOString() };

    if ("link" in body) {
      if (body.link === null || String(body.link).trim() === "") {
        update.messenger_link = null;
      } else {
        const p = parseMessengerLink(String(body.link));
        if ("error" in p) return NextResponse.json({ error: p.error }, { status: 400 });
        update.messenger_link = p.link;
      }
    }

    if ("psid" in body) {
      // Unlink: free up the Page chat so it can be picked for someone else.
      if (!body.psid) {
        if (c.messenger_psid) {
          await admin.from("messenger_contacts").update({ customer_id: null }).eq("psid", c.messenger_psid);
        }
        update.messenger_psid = null;
        update.messenger_last_inbound_at = null;
      } else {
        const psid = String(body.psid);
        const { data: contact } = await admin
          .from("messenger_contacts")
          .select("psid, customer_id, last_inbound_at")
          .eq("psid", psid)
          .maybeSingle();
        if (!contact) return NextResponse.json({ error: "That Page chat wasn't found." }, { status: 404 });
        if (contact.customer_id && contact.customer_id !== c.id) {
          return NextResponse.json({ error: "That Page chat is already linked to another customer." }, { status: 409 });
        }
        if (c.messenger_psid && c.messenger_psid !== psid) {
          await admin.from("messenger_contacts").update({ customer_id: null }).eq("psid", c.messenger_psid);
        }
        update.messenger_psid = psid;
        update.messenger_last_inbound_at = contact.last_inbound_at;
        await admin.from("messenger_contacts").update({ customer_id: c.id }).eq("psid", psid);
      }
    }

    const { error } = await admin.from("shipping_customers").update(update).eq("id", c.id);
    if (error) return NextResponse.json({ error: needsSql(error.message) }, { status: 500 });
    const fresh = await load(admin, c.id);
    return NextResponse.json(shape(fresh));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Saving failed." }, { status: 500 });
  }
}
