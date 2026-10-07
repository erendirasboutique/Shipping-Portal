"use client";

// Quick start guide — an interactive, step-by-step tour of the portal for new team members.
//
// • Opens from the "Quick start guide" button in the sidebar (and once, automatically,
//   the first time someone uses the portal on a new browser).
// • Each step lights up the matching spot in the menu and explains how that page works.
// • "Open this page" goes there and the tour keeps going.
// • ← / → or Enter move between steps, Esc closes. English or Spanish follows the EN | ES switch.

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { usePortalLocale } from "@/components/PortalTranslator";

const OPEN_EVENT = "eb-guide-open";
const STEP_KEY = "eb-guide-step"; // session: which step is open (survives page changes)
const DONE_KEY = "eb-guide-done"; // browser: already seen it once

type Copy = {
  eyebrow: string;
  title: string;
  body: string;
  points?: string[];
  tip?: string;
};

type Step = {
  target?: string; // what to light up in the sidebar
  page?: string; // page this step is about
  icon: string;
  en: Copy;
  es: Copy;
};

const I = {
  hello: "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  menu: "M4 6h16M4 12h16M4 18h16",
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  create: "M12 8v8M8 12h8M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
  print: "M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z",
  pack: "M9 4h6v3H9zM9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3M9 14l2 2 4-4",
  slip: "M6 2h9l5 5v15H6zM15 2v5h5M9 12h6M9 16h6M9 8h2",
  scan: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10",
  barcode: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M8 8v8M11 8v8M14 8v8M17 8v8",
  box: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  returns: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  chart: "M3 3v18h18M8 17V11M13 17V7M18 17v-4",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  truck: "M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  bulb: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z",
  close: "M6 6l12 12M18 6 6 18",
  arrowR: "M5 12h14M13 6l6 6-6 6",
  arrowL: "M19 12H5M11 6l-6 6 6 6",
  check: "M5 12.5l4.5 4.5L19 7",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5",
};

const nav = (href: string) => 'aside nav a[href="' + href + '"]';

const STEPS: Step[] = [
  {
    icon: I.hello,
    en: {
      eyebrow: "Welcome to the team",
      title: "Your quick start guide",
      body: "This is where every Erendira's Boutique order gets its label, gets packed and gets sent. This tour takes about 3 minutes and shows you each page, in the order you'll use them.",
      points: [
        "During the week: lives happen and labels get made.",
        "Saturday is ship day: print, pack, send, drop off.",
        "Customers are told when their package is on the way.",
      ],
      tip: "You can reopen this guide anytime from the menu: Quick start guide.",
    },
    es: {
      eyebrow: "Te damos la bienvenida",
      title: "Tu guía de inicio rápido",
      body: "Aquí cada pedido de Erendira's Boutique recibe su etiqueta, se empaca y se envía. Este recorrido dura unos 3 minutos y te muestra cada página en el orden en que las vas a usar.",
      points: [
        "Entre semana: hay lives y se hacen etiquetas.",
        "El sábado es día de envíos: imprimir, empacar, avisar y llevar al correo.",
        "A las clientas se les avisa cuando su paquete va en camino.",
      ],
      tip: "Puedes volver a abrir esta guía cuando quieras desde el menú: Guía de inicio rápido.",
    },
  },
  {
    target: "aside nav",
    icon: I.menu,
    en: {
      eyebrow: "The menu",
      title: "Everything lives here",
      body: "The menu is split the way the week works.",
      points: [
        "Shipping day: the pages you use to make, print, pack and send.",
        "Manage: orders, customers and returns.",
        "Insights: maps and numbers to see how shipping is going.",
      ],
      tip: "On a phone, tap the ☰ button at the top to open the menu.",
    },
    es: {
      eyebrow: "El menú",
      title: "Aquí está todo",
      body: "El menú está dividido como funciona la semana.",
      points: [
        "Día de envíos: las páginas para hacer, imprimir, empacar y enviar.",
        "Administrar: pedidos, clientes y devoluciones.",
        "Estadísticas: mapas y números para ver cómo van los envíos.",
      ],
      tip: "En el teléfono, toca el botón ☰ arriba para abrir el menú.",
    },
  },
  {
    target: nav("/"),
    page: "/",
    icon: I.home,
    en: {
      eyebrow: "Start here every day",
      title: "Dashboard",
      body: "A quick look at the day before you start.",
      points: [
        "Today's shipments, labels waiting to print and drafts not finished yet.",
        "Next ship day: Saturday's weather in Fontana and any USPS holidays.",
        "Heads up: rain, heat or snow where this week's packages are headed.",
      ],
      tip: "If a USPS holiday falls on ship day, drop packages off Friday instead.",
    },
    es: {
      eyebrow: "Empieza aquí cada día",
      title: "Inicio",
      body: "Un vistazo rápido al día antes de empezar.",
      points: [
        "Envíos de hoy, etiquetas por imprimir y borradores sin terminar.",
        "Próximo día de envío: el clima del sábado en Fontana y feriados de USPS.",
        "Avisos: lluvia, calor o nieve a donde van los paquetes de la semana.",
      ],
      tip: "Si hay feriado de USPS el día de envíos, lleva los paquetes el viernes.",
    },
  },
  {
    target: nav("/create-label"),
    page: "/create-label",
    icon: I.create,
    en: {
      eyebrow: "Shipping day · step 1",
      title: "Create a label",
      body: "One label per package. It takes under a minute.",
      points: [
        "Search the customer by name, email or phone. New customer? Start typing the address and pick it from the list.",
        "Pick the package (My Packaging is the usual 14 × 17 × 1 box) and enter the weight. A USB scale fills it in for you in Chrome.",
        "Press Get rates, pick a rate, then Buy. The 4×6 label is ready to print.",
      ],
      tip: "If One-click purchase is on, tapping a rate buys it right away. Not done? Save draft and finish it later from Orders.",
    },
    es: {
      eyebrow: "Día de envíos · paso 1",
      title: "Crear una etiqueta",
      body: "Una etiqueta por paquete. Toma menos de un minuto.",
      points: [
        "Busca a la clienta por nombre, correo o teléfono. ¿Clienta nueva? Escribe la dirección y elígela de la lista.",
        "Elige el paquete (Mi empaque es la caja normal de 14 × 17 × 1) y escribe el peso. Con la báscula USB se llena solo en Chrome.",
        "Toca Ver tarifas, elige una y luego Comprar. La etiqueta 4×6 queda lista para imprimir.",
      ],
      tip: "Si la compra en un clic está activada, al tocar una tarifa se compra de inmediato. ¿No terminaste? Guarda el borrador y termínalo después desde Pedidos.",
    },
  },
  {
    target: nav("/batch-print"),
    page: "/batch-print",
    icon: I.print,
    en: {
      eyebrow: "Shipping day · step 2",
      title: "Batch Print",
      body: "Print every label in one go instead of one by one.",
      points: [
        "Every label you bought that isn't printed yet waits in the queue.",
        "Select the ones to print (press A to select all).",
        "Press Print (or P). They merge into one PDF and get marked as printed.",
      ],
      tip: "Lost the PDF? Every batch is kept in the Saved PDFs tab, ready to reopen.",
    },
    es: {
      eyebrow: "Día de envíos · paso 2",
      title: "Imprimir en lote",
      body: "Imprime todas las etiquetas de una vez en lugar de una por una.",
      points: [
        "Cada etiqueta comprada que no se ha impreso espera en la cola.",
        "Selecciona las que vas a imprimir (presiona A para seleccionar todas).",
        "Toca Imprimir (o P). Se juntan en un solo PDF y quedan marcadas como impresas.",
      ],
      tip: "¿Se perdió el PDF? Cada lote se guarda en la pestaña PDF guardados para volver a abrirlo.",
    },
  },
  {
    target: nav("/packing-slips"),
    page: "/packing-slips",
    icon: I.slip,
    en: {
      eyebrow: "Shipping day · step 3",
      title: "Packing Slips",
      body: "A branded note that goes inside each box.",
      points: [
        "Pick the orders you're packing.",
        "Type what's in each package, one item per line.",
        "Choose 4×6 or letter size, then Make PDF and print.",
      ],
      tip: "Items you type are saved with the order, so reprinting later is quick.",
    },
    es: {
      eyebrow: "Día de envíos · paso 3",
      title: "Notas de empaque",
      body: "Una nota con la marca que va dentro de cada caja.",
      points: [
        "Elige los pedidos que vas a empacar.",
        "Escribe lo que va en cada paquete, un artículo por línea.",
        "Elige tamaño 4×6 o carta, luego Hacer PDF e imprime.",
      ],
      tip: "Lo que escribes se guarda con el pedido, así que reimprimir después es rápido.",
    },
  },
  {
    target: nav("/packing"),
    page: "/packing",
    icon: I.pack,
    en: {
      eyebrow: "Shipping day · step 4",
      title: "Packing List",
      body: "Your checklist while you pack.",
      points: [
        "Shows every package for this week and what's still left.",
        "Mark each one packed as it goes in the box.",
        "See which customers were already told their package is on the way.",
      ],
      tip: "Anything Muse couldn't send shows up as flagged. Tap it and send by hand.",
    },
    es: {
      eyebrow: "Día de envíos · paso 4",
      title: "Lista de empaque",
      body: "Tu lista mientras empacas.",
      points: [
        "Muestra cada paquete de la semana y lo que falta.",
        "Marca cada uno como empacado cuando entra en la caja.",
        "Ve a qué clientas ya se les avisó que su paquete va en camino.",
      ],
      tip: "Lo que Muse no pudo enviar aparece marcado. Tócalo y envíalo a mano.",
    },
  },
  {
    target: nav("/scan"),
    page: "/scan",
    icon: I.scan,
    en: {
      eyebrow: "Shipping day · step 5 · on your phone",
      title: "Scan & Send",
      body: "Let each customer know her package is on the way, with a photo.",
      points: [
        "Scan the long barcode on the label with your phone camera (or type the EB number).",
        "Take a photo of the packed box.",
        "Tap Send to Messenger. The photo is copied and Messenger opens: paste it, then paste the message too.",
      ],
      tip: "The message is in Spanish and English and includes the tracking link. Then tap Scan next.",
    },
    es: {
      eyebrow: "Día de envíos · paso 5 · en tu teléfono",
      title: "Escanear y enviar",
      body: "Avísale a cada clienta que su paquete va en camino, con una foto.",
      points: [
        "Escanea el código largo de la etiqueta con la cámara (o escribe el número EB).",
        "Toma una foto de la caja empacada.",
        "Toca Enviar a Messenger. La foto se copia y se abre Messenger: pégala y luego pega el mensaje.",
      ],
      tip: "El mensaje va en español e inglés e incluye el enlace de rastreo. Luego toca Escanear siguiente.",
    },
  },
  {
    target: nav("/label-tools"),
    page: "/label-tools",
    icon: I.barcode,
    en: {
      eyebrow: "When something goes wrong",
      title: "Scan a Label",
      body: "Scan or type any label to fix it.",
      points: [
        "Reprint: smudged or lost label, same label, no charge.",
        "Change & rebuy: wrong weight, box or service. The new label is bought first, then the old one is refunded.",
        "Void & refund: only before USPS scans it.",
        "Came back: log a package returned to sender, then fix the address and re-ship.",
      ],
      tip: "Not sure? Ask before voiding. A voided label can't be used again.",
    },
    es: {
      eyebrow: "Cuando algo sale mal",
      title: "Escanear etiqueta",
      body: "Escanea o escribe cualquier etiqueta para arreglarla.",
      points: [
        "Reimprimir: etiqueta manchada o perdida, la misma etiqueta, sin costo.",
        "Cambiar y volver a comprar: peso, caja o servicio equivocado. Primero se compra la nueva y luego se reembolsa la anterior.",
        "Anular y reembolsar: solo antes de que USPS la escanee.",
        "Regresó: registra un paquete devuelto al remitente, corrige la dirección y reenvíalo.",
      ],
      tip: "¿Tienes dudas? Pregunta antes de anular. Una etiqueta anulada ya no se puede usar.",
    },
  },
  {
    target: nav("/orders"),
    page: "/orders",
    icon: I.box,
    en: {
      eyebrow: "Manage",
      title: "Orders",
      body: "Every label ever made, in one searchable list.",
      points: [
        "Search by name, EB number, tracking number or city.",
        "Open an order to see tracking, copy the tracking link or the customer's portal link.",
        "Drafts you saved are here too, ready to finish.",
      ],
      tip: "Each order has an EB number (like EB-123). It's the easiest way to find one.",
    },
    es: {
      eyebrow: "Administrar",
      title: "Pedidos",
      body: "Todas las etiquetas que se han hecho, en una lista que puedes buscar.",
      points: [
        "Busca por nombre, número EB, número de rastreo o ciudad.",
        "Abre un pedido para ver el rastreo y copiar el enlace de rastreo o del portal de la clienta.",
        "Aquí también están los borradores guardados, listos para terminar.",
      ],
      tip: "Cada pedido tiene un número EB (como EB-123). Es la forma más fácil de encontrarlo.",
    },
  },
  {
    target: nav("/customers"),
    page: "/customers",
    icon: I.users,
    en: {
      eyebrow: "Manage",
      title: "Customers",
      body: "The address book. Everyone you've shipped to.",
      points: [
        "Search or jump by letter, then tap a customer to see her orders and notes.",
        "Edit an address before the next label so it's right the first time.",
        "Find duplicates merges repeat entries. Nothing is ever deleted.",
      ],
      tip: "Add a note for sizing or gift wrap preferences. It shows up next time.",
    },
    es: {
      eyebrow: "Administrar",
      title: "Clientes",
      body: "La libreta de direcciones. Todas a quienes les has enviado.",
      points: [
        "Busca o salta por letra, y toca a una clienta para ver sus pedidos y notas.",
        "Corrige una dirección antes de la próxima etiqueta para que salga bien a la primera.",
        "Buscar duplicados combina registros repetidos. Nunca se borra nada.",
      ],
      tip: "Agrega una nota de tallas o preferencias de regalo. Aparece la próxima vez.",
    },
  },
  {
    target: nav("/returns"),
    page: "/returns",
    icon: I.returns,
    en: {
      eyebrow: "Manage",
      title: "Returns",
      body: "From request to refund, in order.",
      points: [
        "A customer asks for a return: make her a return label and send it.",
        "When the package arrives, scan it and mark it received with its condition (and a photo).",
        "Once it's refunded, exchanged or restocked, mark it done.",
      ],
      tip: "Needs a nudge means the customer has had the label a while and hasn't mailed it.",
    },
    es: {
      eyebrow: "Administrar",
      title: "Devoluciones",
      body: "De la solicitud al reembolso, en orden.",
      points: [
        "Una clienta pide una devolución: hazle una etiqueta de devolución y envíasela.",
        "Cuando llegue el paquete, escanéalo y márcalo como recibido con su estado (y una foto).",
        "Cuando ya se reembolsó, cambió o regresó al inventario, márcalo como terminado.",
      ],
      tip: "Hay que recordarle significa que la clienta tiene la etiqueta hace días y no la ha enviado.",
    },
  },
  {
    target: nav("/carrier-performance"),
    page: "/recap",
    icon: I.chart,
    en: {
      eyebrow: "Insights",
      title: "Map, carriers & recap",
      body: "Nothing to do here day to day. It's for seeing the big picture.",
      points: [
        "Shipping Map: where packages go across the country.",
        "Carrier Performance: which service is fastest for the money.",
        "Monthly Recap: packages, postage, returns and top customers for any month.",
      ],
    },
    es: {
      eyebrow: "Estadísticas",
      title: "Mapa, paqueterías y resumen",
      body: "Aquí no hay nada que hacer a diario. Es para ver el panorama.",
      points: [
        "Mapa de envíos: a dónde van los paquetes en el país.",
        "Rendimiento de paqueterías: qué servicio es más rápido por lo que cuesta.",
        "Resumen mensual: paquetes, costo de envíos, devoluciones y mejores clientas de cualquier mes.",
      ],
    },
  },
  {
    target: '[data-tour="prefs"]',
    icon: I.gear,
    en: {
      eyebrow: "Make it yours",
      title: "Language, dark mode & shortcuts",
      body: "Small things that make the portal easier.",
      points: [
        "EN | ES switches the whole portal between English and Spanish.",
        "The moon at the top turns on dark mode.",
        "On a computer, press ? to see keyboard shortcuts (like N for a new label).",
      ],
      tip: "Each person's choices are saved on their own device.",
    },
    es: {
      eyebrow: "Hazlo tuyo",
      title: "Idioma, modo oscuro y atajos",
      body: "Detalles que hacen el portal más fácil.",
      points: [
        "EN | ES cambia todo el portal entre inglés y español.",
        "La luna de arriba activa el modo oscuro.",
        "En la computadora, presiona ? para ver los atajos de teclado (como N para una etiqueta nueva).",
      ],
      tip: "Lo que elige cada persona se guarda en su propio dispositivo.",
    },
  },
  {
    icon: I.truck,
    en: {
      eyebrow: "You're ready",
      title: "Your ship day, start to finish",
      body: "Tap any step to jump to that page.",
      tip: "Questions? Ask Erendira or an admin. You can't break anything by looking around.",
    },
    es: {
      eyebrow: "¡Todo listo!",
      title: "Tu día de envíos, de principio a fin",
      body: "Toca cualquier paso para ir a esa página.",
      tip: "¿Dudas? Pregúntale a Erendira o a un admin. No rompes nada por ver las páginas.",
    },
  },
];

const FLOW: { href: string; en: string; es: string; icon: string }[] = [
  { href: "/", en: "Check the dashboard for holidays and weather", es: "Revisa el inicio por feriados y clima", icon: I.home },
  { href: "/create-label", en: "Make any labels still missing", es: "Haz las etiquetas que falten", icon: I.create },
  { href: "/batch-print", en: "Print all labels in one batch", es: "Imprime todas las etiquetas en un lote", icon: I.print },
  { href: "/packing-slips", en: "Print the packing slips", es: "Imprime las notas de empaque", icon: I.slip },
  { href: "/packing", en: "Pack and check off each box", es: "Empaca y marca cada caja", icon: I.pack },
  { href: "/scan", en: "Scan & Send to tell each customer", es: "Escanea y envía para avisar a cada clienta", icon: I.scan },
];

const UI = {
  en: {
    step: (n: number, t: number) => "Step " + n + " of " + t,
    next: "Next",
    back: "Back",
    start: "Start the tour",
    later: "Maybe later",
    finish: "Finish",
    open: "Open this page",
    here: "You're on this page",
    close: "Close guide",
    inMenu: "In the menu",
    keys: "← → to move · Esc to close",
  },
  es: {
    step: (n: number, t: number) => "Paso " + n + " de " + t,
    next: "Siguiente",
    back: "Atrás",
    start: "Empezar el recorrido",
    later: "Ahora no",
    finish: "Terminar",
    open: "Abrir esta página",
    here: "Estás en esta página",
    close: "Cerrar guía",
    inMenu: "En el menú",
    keys: "← → para avanzar · Esc para cerrar",
  },
};

const NAV_NAMES: Record<string, { en: string; es: string }> = {
  "/": { en: "Dashboard", es: "Inicio" },
  "/create-label": { en: "Create Label", es: "Crear etiqueta" },
  "/batch-print": { en: "Batch Print", es: "Imprimir en lote" },
  "/packing": { en: "Packing List", es: "Lista de empaque" },
  "/packing-slips": { en: "Packing Slips", es: "Notas de empaque" },
  "/scan": { en: "Scan & Send", es: "Escanear y enviar" },
  "/label-tools": { en: "Scan a Label", es: "Escanear etiqueta" },
  "/orders": { en: "Orders", es: "Pedidos" },
  "/customers": { en: "Customers", es: "Clientes" },
  "/returns": { en: "Returns", es: "Devoluciones" },
  "/recap": { en: "Insights", es: "Estadísticas" },
};

function Icon({ d, size = 18, w = 1.8 }: { d: string; size?: number; w?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSession(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {}
}

type Box = { top: number; left: number; width: number; height: number };

export default function QuickStartGuide() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = usePortalLocale();
  const [step, setStep] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [wide, setWide] = useState(false);
  const [cardH, setCardH] = useState(420);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const t = UI[locale];
  const total = STEPS.length;
  const s = step === null ? null : STEPS[step];
  const c = s ? s[locale] : null;

  // Open: from the sidebar button, from a page change mid-tour, or the very first visit.
  useEffect(() => {
    const open = () => setStep(0);
    window.addEventListener(OPEN_EVENT, open);

    const saved = readSession(STEP_KEY);
    if (saved !== null && !isNaN(Number(saved))) {
      setStep(Math.min(Math.max(0, Number(saved)), STEPS.length - 1));
    } else {
      let seen = true;
      try {
        seen = window.localStorage.getItem(DONE_KEY) === "1";
      } catch {}
      if (!seen) setStep(0);
    }
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  useEffect(() => {
    writeSession(STEP_KEY, step === null ? null : String(step));
  }, [step]);

  const close = useCallback(() => {
    setStep(null);
    writeSession(STEP_KEY, null);
    try {
      window.localStorage.setItem(DONE_KEY, "1");
    } catch {}
  }, []);

  const go = useCallback((n: number) => {
    if (n < 0) return;
    if (n >= STEPS.length) close();
    else setStep(n);
  }, [close]);

  // Keyboard: ← → Enter Esc
  useEffect(() => {
    if (step === null) return;
    const current = step;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight" || (e.key === "Enter" && !(el && el.tagName === "BUTTON"))) {
        e.preventDefault();
        go(current + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(current - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, go, close]);

  // Where the lit-up spot is (desktop only — on phones the menu is tucked away)
  const measure = useCallback(() => {
    const isWide = window.innerWidth >= 1024;
    setWide(isWide);
    const target = step === null ? null : STEPS[step].target;
    if (!isWide || !target) {
      setBox(null);
      return;
    }
    const el = document.querySelector(target) as HTMLElement | null;
    if (!el) {
      setBox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setBox(null);
      return;
    }
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useEffect(() => {
    if (step === null) return;
    const target = STEPS[step].target;
    if (target && window.innerWidth >= 1024) {
      const el = document.querySelector(target) as HTMLElement | null;
      if (el && target !== "aside nav") el.scrollIntoView({ block: "nearest" });
    }
    measure();
    const again = window.setTimeout(measure, 250);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(again);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, pathname, measure]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [step, locale, wide, box]);

  if (step === null || !s || !c) return null;

  const first = step === 0;
  const last = step === total - 1;
  const centered = first || last || !box;
  const onPage = s.page ? (s.page === "/" ? pathname === "/" : pathname === s.page || pathname.startsWith(s.page + "/")) : false;
  const pad = 6;

  // Card position next to the lit-up spot
  let cardStyle: CSSProperties | undefined;
  let arrowTop = 0;
  if (box && wide && !first && !last) {
    const vh = window.innerHeight;
    const centerY = box.top + Math.min(box.height, 60) / 2;
    const top = Math.max(16, Math.min(centerY - 56, vh - cardH - 16));
    cardStyle = { position: "fixed", left: box.left + box.width + 22, top, width: 400 };
    arrowTop = Math.max(20, Math.min(centerY - top, cardH - 20));
  }

  const navName = s.page && NAV_NAMES[s.page] ? NAV_NAMES[s.page][locale] : null;

  const progress = (
    <div className="flex min-w-0 flex-wrap items-center gap-1" aria-hidden="true">
      {STEPS.map((_, i) => (
        <span
          key={i}
          className={"h-1.5 rounded-full transition-all " + (i === step ? "w-5 bg-taupe" : i < step ? "w-1.5 bg-taupe/50" : "w-1.5 bg-sand/60")}
        />
      ))}
    </div>
  );

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sand/30 text-taupe">
            <Icon d={s.icon} size={21} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink/55">{c.eyebrow}</p>
            <p className="text-xs text-ink/45">{t.step(step + 1, total)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t.close}
          title={t.close}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink/45 hover:bg-sand/25 hover:text-taupe"
        >
          <Icon d={I.close} size={16} />
        </button>
      </div>

      <h2 className="mt-3 font-heading text-[30px] leading-[1.15] text-taupe">{c.title}</h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink/80">{c.body}</p>

      {c.points && (
        <ol className="mt-4 flex flex-col gap-2.5">
          {c.points.map((p, i) => (
            <li key={i} className="flex gap-3 text-[14.5px] leading-snug">
              <span className="mt-[1px] grid h-6 w-6 shrink-0 place-items-center rounded-full bg-taupe text-[12px] font-semibold text-cream">
                {i + 1}
              </span>
              <span className="pt-0.5">{p}</span>
            </li>
          ))}
        </ol>
      )}

      {last && (
        <ol className="mt-4 flex flex-col gap-1.5">
          {FLOW.map((f, i) => (
            <li key={f.href}>
              <button
                type="button"
                onClick={() => {
                  close();
                  router.push(f.href);
                }}
                className="group flex w-full items-center gap-3 rounded-2xl border border-sand/50 bg-white px-3 py-2.5 text-left text-[14.5px] transition-colors hover:border-taupe/60 hover:bg-sand/15 dark:bg-transparent"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sand/30 text-taupe">
                  <Icon d={f.icon} size={16} />
                </span>
                <span className="flex-1">
                  <span className="mr-1.5 text-ink/45">{i + 1}.</span>
                  {f[locale]}
                </span>
                <span className="text-ink/30 transition-colors group-hover:text-taupe">
                  <Icon d={I.arrowR} size={15} />
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {c.tip && (
        <div className="mt-4 flex gap-2.5 rounded-2xl bg-sand/20 px-3.5 py-3 text-[13.5px] leading-snug text-ink/75">
          <span className="mt-[1px] shrink-0 text-taupe">
            <Icon d={I.bulb} size={16} />
          </span>
          <span>{c.tip}</span>
        </div>
      )}

      {/* Where it is, when the menu isn't lit up (phones) */}
      {!box && navName && !first && !last && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink/55">
          <Icon d={I.menu} size={13} />
          {t.inMenu}: <b className="font-semibold text-taupe">{navName}</b>
        </p>
      )}

      {s.page && !first && !last && (
        <div className="mt-4">
          {onPage ? (
            <p className="flex items-center gap-1.5 text-[13px] text-taupe">
              <Icon d={I.check} size={15} w={2.4} />
              {t.here}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => router.push(s.page as string)}
              className="inline-flex items-center gap-1.5 rounded-full border border-taupe/40 px-3.5 py-1.5 text-[13px] text-taupe transition-colors hover:bg-taupe/10"
            >
              {t.open}
              <Icon d={I.arrowR} size={14} />
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      {first ? (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" onClick={() => go(1)} className="btn-primary h-11 flex-1">
            {t.start}
            <Icon d={I.arrowR} size={16} />
          </button>
          <button type="button" onClick={close} className="btn-secondary h-11 flex-1">
            {t.later}
          </button>
        </div>
      ) : (
        <div className="mt-6 flex items-center justify-between gap-3">
          {progress}
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => go(step - 1)} aria-label={t.back} title={t.back} className="btn-secondary h-10 w-10 !px-0">
              <Icon d={I.arrowL} size={15} />
            </button>
            <button type="button" onClick={() => go(step + 1)} className="btn-primary h-10 !px-5">
              {last ? t.finish : t.next}
              {!last && <Icon d={I.arrowR} size={15} />}
              {last && <Icon d={I.check} size={15} w={2.4} />}
            </button>
          </div>
        </div>
      )}
      {!first && <p className="mt-3 hidden text-center text-[11px] text-ink/40 lg:block">{t.keys}</p>}
    </>
  );

  return (
    <div translate="no" data-no-translate="" role="dialog" aria-modal="true" aria-label={c.title} className="fixed inset-0 z-[90]">
      {/* Dim everything; lit-up spot stays clear */}
      {box && !centered ? (
        <>
          <div className="absolute inset-0" onClick={close} />
          <div
            className="pointer-events-none fixed rounded-[14px] ring-2 ring-taupe transition-all duration-300 ease-out"
            style={{
              top: box.top - pad,
              left: box.left - pad,
              width: box.width + pad * 2,
              height: box.height + pad * 2,
              boxShadow: "0 0 0 9999px rgba(51,43,35,0.5)",
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={first ? undefined : close} />
      )}

      {cardStyle ? (
        <div ref={cardRef} style={cardStyle} className="rounded-[28px] border border-sand/60 bg-cream p-6 shadow-[0_20px_60px_-12px_rgba(51,43,35,0.45)] transition-[top] duration-300">
          <span
            className="absolute -left-[9px] h-4 w-4 rotate-45 border-b border-l border-sand/60 bg-cream"
            style={{ top: arrowTop - 8 }}
            aria-hidden="true"
          />
          <div className="relative">{body}</div>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-3 sm:items-center sm:p-6">
          <div
            ref={cardRef}
            className={
              "pointer-events-auto max-h-[calc(100dvh-24px)] w-full overflow-y-auto rounded-[28px] border border-sand/60 bg-cream p-5 shadow-[0_20px_60px_-12px_rgba(51,43,35,0.45)] sm:p-7 " +
              (first || last ? "max-w-[480px]" : "max-w-[420px]")
            }
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            {first && (
              <div className="-mx-1 mb-4 flex items-center justify-center rounded-[22px] bg-sand/20 py-5">
                <img src="/EB_Logo_Fall BGBLANK.png" alt="" className="h-16 w-auto" />
              </div>
            )}
            {body}
          </div>
        </div>
      )}
    </div>
  );
}

/** Button for the sidebar that opens the guide. */
export function QuickStartButton({ className = "" }: { className?: string }) {
  const locale = usePortalLocale();
  return (
    <button
      type="button"
      translate="no"
      data-no-translate=""
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className={
        "flex h-[38px] w-full items-center gap-3 rounded-[10px] px-2.5 text-[14.5px] text-ink/80 transition-colors hover:bg-sand/20 " + className
      }
    >
      <span className="text-taupe">
        <Icon d={I.book} />
      </span>
      {locale === "es" ? "Guía de inicio rápido" : "Quick start guide"}
    </button>
  );
}
