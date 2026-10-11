// app/api/live-list/[id]/stickers/route.ts
// Staff only. The inside + outside stickers for one Live List row: a
// two-page 2.25 x 1.25" PDF for the Rollo, opened inline so the phone's
// share sheet / print dialog is one tap away.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildStickerPair } from "@/lib/live/label";
import { ebNumber, LIVE_LIST_SELECT, staffUser } from "@/lib/liveList";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await staffUser())) return new Response("Unauthorized", { status: 401 });

  const { data, error }: { data: any; error: any } = await supabaseAdmin()
    .from("live_list")
    .select(LIVE_LIST_SELECT)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return new Response(error.message, { status: 500 });
  if (!data) return new Response("Not found", { status: 404 });

  // Bottom line: the week, plus the EB number once the label is bought.
  const [y, m, d] = String(data.week_start).split("-").map(Number);
  const week = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const sub = [`Week of ${week}`, ebNumber(data.order?.order_number)].filter(Boolean).join(" · ");

  const pdf = await buildStickerPair({ number: data.number, name: data.name, sub });

  return new Response(pdf as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="stickers-${data.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
