// app/api/broadcasts/[id]/send/route.ts
// Staff only. Sends the next small batch of a send. The page calls this
// over and over until "remaining" is 0 (keeps each call well under the time limit).
import { NextResponse } from "next/server";
import { sendBatch } from "@/lib/broadcast";
import { staff } from "@/lib/broadcastApi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await sendBatch(params.id, 8));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Send failed." }, { status: 400 });
  }
}
