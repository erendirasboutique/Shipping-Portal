// app/api/public/contact-card/route.ts
// Public. Erendira's Boutique contact card (.vcf). Texts attach this URL so the
// customer can tap "Add contact"; emails attach the same card as a file.
import { contactCard } from "@/lib/broadcast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const card = await contactCard();
  return new Response(card, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": 'attachment; filename="Erendiras-Boutique.vcf"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
