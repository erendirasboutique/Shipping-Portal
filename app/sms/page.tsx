// app/sms/page.tsx — public text sign-up page. Share this link in lives,
// Messenger and the bio; the shipping emails link here too.
import SmsSignup from "@/components/SmsSignup";

export const metadata = { title: { absolute: "Recibe mensajes de texto — Erendira's Boutique" } };

export default function SmsPage() {
  return (
    <main className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="font-heading text-4xl leading-tight text-taupe">Recibe tus actualizaciones por texto</h1>
        <p className="mt-3 text-base leading-relaxed text-ink/80">
          Te avisamos cuando tu pedido esté empacado, en camino y entregado, y cuando estemos en vivo o tengamos ofertas.
        </p>
        <p className="mt-1 text-sm text-ink/60">Get order updates and live alerts by text.</p>
      </div>
      <SmsSignup />
    </main>
  );
}
