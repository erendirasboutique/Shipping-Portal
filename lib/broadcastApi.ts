// lib/broadcastApi.ts — shared bits for the /api/broadcasts routes.
import { supabaseServer } from "@/lib/supabase/server";
import type { Message } from "@/lib/broadcast";

export async function staff() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  return user;
}

/** Only the fields we use, as strings/booleans, length-capped. */
export function cleanMessage(raw: any): Message {
  const str = (v: any, max: number) => String(v ?? "").slice(0, max);
  return {
    sms_body: str(raw?.sms_body, 1200),
    email_subject: str(raw?.email_subject, 200),
    email_heading: str(raw?.email_heading, 200),
    email_body: str(raw?.email_body, 5000),
    button_text: str(raw?.button_text, 60),
    button_link: str(raw?.button_link, 500),
    attach_card_sms: !!raw?.attach_card_sms,
    attach_card_email: !!raw?.attach_card_email,
  };
}
