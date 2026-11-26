// app/api/notifications/route.ts
// Staff only. Settings › Notifications: load and save the 4 messages + branding.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_SETTINGS, STAGES, emailConfigured, smsConfigured } from "@/lib/customerNotify";

export const dynamic = "force-dynamic";

async function signedIn() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  return user;
}

export async function GET() {
  if (!(await signedIn())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin: any = supabaseAdmin();
  const [{ data: settings, error: sErr }, { data: templates, error: tErr }] = await Promise.all([
    admin.from("notification_settings").select("*").eq("id", 1).maybeSingle(),
    admin.from("notification_templates").select("*").order("sort"),
  ]);
  if (sErr || tErr) {
    return NextResponse.json(
      { error: "The notifications tables aren't in Supabase yet. Run supabase/customer-notifications.sql in the SQL Editor.", needsSetup: true },
      { status: 400 }
    );
  }
  return NextResponse.json({
    settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
    templates: templates || [],
    ready: { email: emailConfigured(), sms: smsConfigured() },
  });
}

const TEMPLATE_FIELDS = ["email_enabled", "sms_enabled", "subject", "heading_es", "body_es", "sms_body"] as const;
const SETTINGS_FIELDS = ["enabled", "logo_url", "tagline", "business_address", "reply_to", "color_background", "color_accent", "color_border", "color_text"] as const;

export async function PUT(req: Request) {
  if (!(await signedIn())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const admin: any = supabaseAdmin();
  const now = new Date().toISOString();

  if (body.settings && typeof body.settings === "object") {
    const patch: Record<string, any> = { updated_at: now };
    for (const k of SETTINGS_FIELDS) if (k in body.settings) patch[k] = body.settings[k];
    for (const k of ["color_background", "color_accent", "color_border", "color_text"]) {
      if (k in patch && !/^#[0-9a-fA-F]{3,8}$/.test(String(patch[k] || ""))) {
        return NextResponse.json({ error: "Colors must look like #957f67." }, { status: 400 });
      }
    }
    if (patch.reply_to && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(patch.reply_to).trim())) {
      return NextResponse.json({ error: "The reply-to email doesn't look right." }, { status: 400 });
    }
    if (patch.logo_url && !/^https:\/\//.test(patch.logo_url)) {
      return NextResponse.json({ error: "The logo link must start with https://" }, { status: 400 });
    }
    const { error } = await admin.from("notification_settings").update(patch).eq("id", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (Array.isArray(body.templates)) {
    for (const t of body.templates) {
      if (!STAGES.includes(t?.stage)) continue;
      const patch: Record<string, any> = { updated_at: now };
      for (const k of TEMPLATE_FIELDS) if (k in t) patch[k] = t[k];
      if ("subject" in patch && !String(patch.subject || "").trim()) {
        return NextResponse.json({ error: "Every email needs a subject line." }, { status: 400 });
      }
      const { error } = await admin.from("notification_templates").update(patch).eq("stage", t.stage);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }
  return NextResponse.json({ ok: true });
}
