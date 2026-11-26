// app/sms/privacy/page.tsx — SMS privacy policy (public). Linked in the Telnyx campaign.
export const metadata = { title: { absolute: "Política de privacidad de SMS — Erendira's Boutique" } };

const UPDATED = "25 de noviembre de 2026 · November 25, 2026";

function Section({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-xl text-taupe">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink/85">{children}</div>
    </section>
  );
}

export default function SmsPrivacyPage() {
  return (
    <main className="flex flex-col gap-8 rounded-3xl border border-taupe/20 bg-white p-6 sm:p-8">
      <div>
        <h1 className="font-heading text-3xl text-taupe">Política de privacidad de mensajes de texto (SMS)</h1>
        <p className="mt-1 text-sm text-ink/60">SMS Privacy Policy · Actualizado / Updated: {UPDATED}</p>
      </div>

      <Section title="Español">
        <p>
          <b>Qué guardamos:</b> tu nombre, tu número de celular, la fecha y hora en que te suscribiste, y el texto del consentimiento que
          aceptaste. También guardamos un registro de los mensajes que te enviamos.
        </p>
        <p>
          <b>Para qué lo usamos:</b> solo para enviarte los mensajes del programa de Erendira&rsquo;s Boutique (pedidos, envíos, respuestas
          y anuncios de lives y ofertas) y para cumplir con tu solicitud de cancelar.
        </p>
        <p>
          <b>No compartimos tu información:</b> no se compartirá información móvil con terceros ni afiliados para fines de marketing o
          promoción. Los datos y el consentimiento de suscripción a mensajes de texto no se compartirán con ningún tercero. Solo usamos a
          nuestro proveedor de mensajes de texto para entregar los mensajes.
        </p>
        <p>
          <b>Cancelar o borrar tus datos:</b> responde <b>STOP</b> para dejar de recibir mensajes. Para pedir que borremos tu número,
          escríbenos a <a className="underline" href="mailto:hello@erendirasboutique.com">hello@erendirasboutique.com</a>.
        </p>
      </Section>

      <div className="h-px bg-taupe/20" />

      <Section title="English">
        <p>
          <b>What we collect:</b> your name, mobile number, the date and time you opted in, and the consent wording you agreed to. We also
          keep a record of the messages we send you.
        </p>
        <p>
          <b>How we use it:</b> only to send you Erendira&rsquo;s Boutique program messages (orders, shipping, replies, and announcements
          about lives and sales) and to honor opt-out requests.
        </p>
        <p>
          <b>We don&rsquo;t share it:</b> No mobile information will be shared with third parties or affiliates for marketing or promotional
          purposes. Text messaging opt-in data and consent will not be shared with any third parties. We only use our text-messaging provider
          to deliver the messages.
        </p>
        <p>
          <b>Opt out or delete your data:</b> reply <b>STOP</b> to stop messages. To ask us to delete your number, email{" "}
          <a className="underline" href="mailto:hello@erendirasboutique.com">hello@erendirasboutique.com</a>.
        </p>
      </Section>
    </main>
  );
}
