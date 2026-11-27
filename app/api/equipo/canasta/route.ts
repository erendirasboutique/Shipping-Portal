// app/api/equipo/canasta/route.ts
// Staff only.
//   GET  ?b=<basketId>  or  ?sale=<id>&n=<number>
//        One basket for the stations (Saturday scan, Thursday screen).
//   POST { sale_id, number, customer_id?, photo_url?, total_cents, by? }
//        Thursday: save the photo and the all-in total, close the basket
//        (status "finalized" = waiting for payment) and return the
//        Messenger message. Works for quick-mode baskets with no items.

import { NextResponse } from "next/server";
import { staffUser } from "@/lib/liveList";
import { liveDb } from "@/lib/live/supabase";
import { ensureBasket, getBasketDetail } from "@/lib/live/queries";
import { recordEvent } from "@/lib/live/timeline";
import { basketMessage, portalUrl } from "@/lib/live/messages";
import { ensureShortLink } from "@/lib/live/shortlink";
import { flatten, messengerFor } from "@/lib/equipo/data";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function oneBasket(id: string) {
  const b = await getBasketDetail(id);
  if (!b) return null;
  const m = b.customer_id ? (await messengerFor([b.customer_id])).get(b.customer_id) : undefined;
  return flatten(b, m ? { auto: m.auto, reason: m.reason, openUrl: m.openUrl } : null);
}

export async function GET(req: Request) {
  const user = await staffUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const url = new URL(req.url);
    let id = url.searchParams.get("b") || "";
    if (!id) {
      const sale = url.searchParams.get("sale") || "";
      const n = Number(url.searchParams.get("n"));
      if (!UUID.test(sale) || !Number.isInteger(n) || n < 1) {
        return NextResponse.json({ error: "Falta el número de canasta" }, { status: 400 });
      }
      const { data } = await liveDb().from("baskets").select("id").eq("live_sale_id", sale).eq("basket_number", n).maybeSingle();
      if (!data) return NextResponse.json({ basket: null });
      id = (data as any).id;
    }
    // A scanned sticker may be a full URL: keep just the id.
    const m = id.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!m) return NextResponse.json({ error: "Ese código no es de una canasta" }, { status: 400 });
    const basket = await oneBasket(m[0]);
    if (!basket) return NextResponse.json({ error: "No encontramos esa canasta" }, { status: 404 });
    return NextResponse.json({ basket }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await staffUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const saleId = String(body.sale_id || "");
    const number = Number(body.number);
    const total = Math.round(Number(body.total_cents));
    const by = (typeof body.by === "string" && body.by.trim()) || user.email || "staff";

    if (!UUID.test(saleId)) return NextResponse.json({ error: "Elige el live" }, { status: 400 });
    if (!Number.isInteger(number) || number < 1 || number > 9999) {
      return NextResponse.json({ error: "Escribe el número de la canasta" }, { status: 400 });
    }
    if (!Number.isFinite(total) || total <= 0) return NextResponse.json({ error: "Escribe el total" }, { status: 400 });

    const basket = await ensureBasket(saleId, number, by);
    if (basket.status === "paid" || basket.status === "shipped") {
      return NextResponse.json({ error: `La canasta #${number} ya está pagada.` }, { status: 409 });
    }

    const customerId = typeof body.customer_id === "string" && UUID.test(body.customer_id) ? body.customer_id : basket.customer_id;
    if (!customerId) return NextResponse.json({ error: "Elige a la clienta de esta canasta" }, { status: 400 });

    const photo = typeof body.photo_url === "string" && /^https:\/\//.test(body.photo_url) ? body.photo_url : basket.photo_url;
    if (!photo) return NextResponse.json({ error: "Toma la foto de la canasta" }, { status: 400 });

    const patch: Record<string, unknown> = {
      customer_id: customerId,
      photo_url: photo,
      manual_total_cents: total,
      discount_cents: 0,
      status: "finalized",
      finalized_by: by,
    };
    if (basket.status !== "finalized") patch.finalized_at = new Date().toISOString();

    const { error } = await liveDb().from("baskets").update(patch).eq("id", basket.id);
    if (error) throw new Error(error.message);

    if (customerId !== basket.customer_id) {
      await recordEvent({ basketId: basket.id, kind: "customer_matched", actor: by, detail: { customer_id: customerId } });
    }
    await recordEvent({ basketId: basket.id, kind: "finalized", actor: by, detail: { total_cents: total, station: "equipo" } });

    const detail = await getBasketDetail(basket.id);
    if (!detail) throw new Error("Se guardó, pero no se pudo leer la canasta.");
    const token = detail.customer?.portal_token || null;
    let message = "";
    if (token) {
      const short = await ensureShortLink({ customerId, longUrl: portalUrl(token) }).catch(() => null);
      message = basketMessage({ locale: "es", totalCents: detail.total_cents, portalToken: token, overrideLink: short });
    }

    const m = (await messengerFor([customerId])).get(customerId);
    return NextResponse.json({
      basket: flatten(detail, m ? { auto: m.auto, reason: m.reason, openUrl: m.openUrl } : null),
      message,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
