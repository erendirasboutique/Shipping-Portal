"use client";

// Employee start page — ship.erendirasboutique.com/e
//
// A calm landing page for staff: just the five pages they use, each with a
// short explanation of what it's for, in English and Spanish. No sidebar,
// no dashboard numbers. The language choice is the same one the rest of the
// portal uses, so picking Español here keeps the other pages in Spanish too.

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { setPortalLocale, usePortalLocale, type PortalLocale } from "@/components/PortalTranslator";

const LOGO = "/EB_Logo_Fall BGBLANK.png";

type Item = {
  href: string;
  d: string;
  en: { title: string; when: string; what: string };
  es: { title: string; when: string; what: string };
};

const ITEMS: Item[] = [
  {
    href: "/live-list",
    d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    en: {
      title: "Live List",
      when: "Friday night",
      what: "Type each paid customer's name and press Enter. They get the next number for the week (#1, #2…). Print their stickers with the button next to the name. Numbers restart every Sunday.",
    },
    es: {
      title: "Lista del Live",
      when: "Viernes en la noche",
      what: "Escribe el nombre de cada clienta que ya pagó y presiona Enter. Le toca el siguiente número de la semana (#1, #2…). Imprime sus etiquetas con el botón junto al nombre. Los números empiezan de nuevo cada domingo.",
    },
  },
  {
    href: "/orders",
    d: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
    en: {
      title: "Orders",
      when: "Anytime",
      what: "Every shipping label that's been made. Search a name or EB number to see the address, tracking, and whether it was packed and sent.",
    },
    es: {
      title: "Pedidos",
      when: "Cuando sea",
      what: "Todas las etiquetas de envío que se han hecho. Busca un nombre o número EB para ver la dirección, el rastreo y si ya se empacó y se envió.",
    },
  },
  {
    href: "/scan",
    d: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10",
    en: {
      title: "Scan & Send",
      when: "Packing day, on your phone",
      what: "Scan the label, take a photo of the package, then send it to the customer on Messenger. The order is marked as sent, so it warns you if the same package gets scanned twice.",
    },
    es: {
      title: "Escanear y Enviar",
      when: "Día de empacar, en tu teléfono",
      what: "Escanea la etiqueta, toma una foto del paquete y mándasela a la clienta por Messenger. El pedido se marca como enviado y te avisa si escaneas el mismo paquete dos veces.",
    },
  },
  {
    href: "/label-tools",
    d: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M8 8v8M11 8v8M14 8v8M17 8v8",
    en: {
      title: "Scan a Label",
      when: "When a label has a problem",
      what: "Scan any label to reprint it if it came out smudged, cancel it if it went on the wrong box, or log a package that came back to us and send it again.",
    },
    es: {
      title: "Escanear Etiqueta",
      when: "Cuando una etiqueta tiene un problema",
      what: "Escanea cualquier etiqueta para volver a imprimirla si salió borrosa, cancelarla si se puso en la caja equivocada, o registrar un paquete que nos regresaron y enviarlo otra vez.",
    },
  },
  {
    href: "/returns",
    d: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
    en: {
      title: "Returns",
      when: "When a customer sends something back",
      what: "See every return request and where it's at. When a return package arrives, find it here and mark it received.",
    },
    es: {
      title: "Devoluciones",
      when: "Cuando una clienta regresa algo",
      what: "Mira todas las solicitudes de devolución y en qué estado van. Cuando llegue un paquete devuelto, búscalo aquí y márcalo como recibido.",
    },
  },
];

const COPY = {
  en: {
    hi: "Hi! What are you working on?",
    sub: "Tap a page to open it. Come back here anytime from this link.",
    full: "Open the full portal",
    lang: "Español",
  },
  es: {
    hi: "¡Hola! ¿En qué vas a trabajar?",
    sub: "Toca una página para abrirla. Puedes regresar aquí con este enlace cuando quieras.",
    full: "Abrir el portal completo",
    lang: "English",
  },
};

function Icon({ d }: { d: string }) {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function EmployeeStart() {
  const locale: PortalLocale = usePortalLocale();
  const t = COPY[locale];

  // This page has no sidebar, so apply the saved light/dark theme here.
  useEffect(() => {
    try {
      document.documentElement.classList.toggle("dark", localStorage.getItem("theme") === "dark");
    } catch {}
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <main translate="no" className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <Image src={LOGO} alt="Erendira's Boutique" width={170} height={72} className="h-10 w-auto" priority />
        <button
          onClick={() => setPortalLocale(locale === "es" ? "en" : "es")}
          className="btn-secondary !px-4"
          aria-label={locale === "es" ? "Switch to English" : "Cambiar a español"}
        >
          {t.lang}
        </button>
      </header>

      <section className="mt-8">
        <h1 className="text-3xl leading-tight sm:text-4xl">{t.hi}</h1>
        <p className="mt-2 text-ink/70">{t.sub}</p>
      </section>

      <ul className="mt-6 grid gap-4">
        {ITEMS.map((item) => {
          const c = item[locale];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="card group flex items-start gap-4 !p-5 transition hover:border-taupe/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-taupe"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sand/30 text-taupe">
                  <Icon d={item.d} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xl font-medium text-ink">{c.title}</span>
                    <span className="text-taupe transition group-hover:translate-x-0.5" aria-hidden="true">→</span>
                  </span>
                  <span className="mt-0.5 block text-xs font-medium uppercase tracking-wide text-taupe">{c.when}</span>
                  <span className="mt-2 block text-sm leading-relaxed text-ink/75">{c.what}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-center">
        <Link href="/" className="text-sm text-taupe underline underline-offset-4 hover:opacity-80">
          {t.full}
        </Link>
      </p>
    </main>
  );
}
