// app/sms/* — public pages for the text-message program:
//   /sms          sign-up form
//   /sms/terms    SMS terms (linked in the Telnyx campaign)
//   /sms/privacy  SMS privacy policy (linked in the Telnyx campaign)
import { BRAND_LOGO } from "@/lib/brand";

export const metadata = {
  title: { absolute: "Mensajes de texto — Erendira's Boutique" },
  robots: { index: true, follow: true },
};

export default function SmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream px-4 py-10 text-ink">
      <div className="mx-auto flex max-w-xl flex-col gap-8">
        <header className="flex justify-center">
          <a href="/sms">
            <img src={BRAND_LOGO} alt="Erendira's Boutique" className="h-auto w-48" />
          </a>
        </header>
        {children}
        <footer className="flex flex-col items-center gap-2 pb-6 text-center text-xs text-ink/60">
          <div className="flex gap-4">
            <a href="/sms" className="underline">Suscribirse</a>
            <a href="/sms/terms" className="underline">Términos SMS</a>
            <a href="/sms/privacy" className="underline">Privacidad SMS</a>
          </div>
          <p>Erendira&rsquo;s Boutique · hello@erendirasboutique.com</p>
        </footer>
      </div>
    </div>
  );
}
