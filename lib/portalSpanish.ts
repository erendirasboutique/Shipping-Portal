// Spanish for the staff shipping portal.
//
// The pages are written in English. When someone switches to Español,
// components/PortalTranslator.tsx swaps each piece of text on screen for the
// Spanish below (and swaps it back for English). Nothing in the pages changes.
//
// To fix a word: find the English on the left, change the Spanish on the right.
// Anything not listed here simply stays in English.

/* ------------------------------------------------------------------ */
/* Exact text                                                          */
/* ------------------------------------------------------------------ */

export const ES: Record<string, string> = {
  // ---------- Menu ----------
  "Dashboard": "Inicio",
  "Shipping day": "Día de envíos",
  "Create Label": "Crear etiqueta",
  "Create label": "Crear etiqueta",
  "Create a Label": "Crear una etiqueta",
  "Create a label": "Crear una etiqueta",
  "Create a new label": "Crear una etiqueta nueva",
  "Batch Print": "Imprimir en lote",
  "Packing List": "Lista de empaque",
  "Packing list": "Lista de empaque",
  "Packing Slips": "Notas de empaque",
  "Packing slip": "Nota de empaque",
  "Scan & Send": "Escanear y enviar",
  "Open Scan & Send": "Abrir Escanear y enviar",
  "Scan a Label": "Escanear etiqueta",
  "Scan a label": "Escanear una etiqueta",
  "Manage": "Administrar",
  "Orders": "Pedidos",
  "Customers": "Clientes",
  "Returns": "Devoluciones",
  "Insights": "Estadísticas",
  "Shipping Map": "Mapa de envíos",
  "Carrier Performance": "Rendimiento de paqueterías",
  "Monthly Recap": "Resumen mensual",
  "Monthly recap": "Resumen mensual",
  "Main": "Principal",
  "Open menu": "Abrir menú",
  "Close menu": "Cerrar menú",
  "Next ship day": "Próximo día de envío",
  "Ship day is today": "Hoy es día de envío",
  "Sign out": "Cerrar sesión",
  "Dark mode": "Modo oscuro",
  "Light mode": "Modo claro",
  "Switch to dark mode": "Cambiar a modo oscuro",
  "Switch to light mode": "Cambiar a modo claro",
  "Keyboard shortcuts": "Atajos de teclado",
  "Keyboard Shortcuts": "Atajos de teclado",
  "Back to dashboard": "Volver al inicio",
  "Shipping Studio": "Estudio de envíos",
  "Shipping Portal": "Portal de envíos",

  // ---------- Keyboard shortcuts ----------
  "Work faster": "Trabaja más rápido",
  "Go to": "Ir a",
  "Anywhere": "En cualquier página",
  "Jump to the search box": "Ir al cuadro de búsqueda",
  "Show this list": "Mostrar esta lista",
  "Close / clear": "Cerrar / borrar",
  "On certain pages": "En algunas páginas",
  "Batch Print: print": "Imprimir en lote: imprimir",
  "Batch Print: select all": "Imprimir en lote: seleccionar todo",
  "Scan a Label: reprint": "Escanear etiqueta: reimprimir",
  "Shortcuts pause while you're typing in a box, so they never get in the way.":
    "Los atajos se pausan mientras escribes en un cuadro, así que nunca estorban.",
  "Going to…": "Abriendo…",

  // ---------- Dashboard ----------
  "Create 4×6 labels, manage customers, review shipments, and print batches.":
    "Crea etiquetas 4×6, administra clientes, revisa envíos e imprime en lote.",
  "Today": "Hoy",
  "Today ·": "Hoy ·",
  "shipments created": "envíos creados",
  "Start →": "Empezar →",
  "Start here": "Empieza aquí",
  "Start": "Empezar",
  "Quick Actions": "Acciones rápidas",
  "Search customer, choose rate, buy 4×6 PDF": "Busca al cliente, elige tarifa, compra el PDF 4×6",
  "Latest activity": "Actividad reciente",
  "Recent Shipments": "Envíos recientes",
  "Today's Shipments": "Envíos de hoy",
  "Created today": "Creados hoy",
  "Print Queue": "Cola de impresión",
  "Ready to print": "Listas para imprimir",
  "Pending Labels": "Etiquetas pendientes",
  "Drafts/rates ready": "Borradores / tarifas listas",
  "Saved profiles": "Perfiles guardados",
  "Labels Purchased": "Etiquetas compradas",
  "All-time purchased": "Compradas en total",
  "Review shipments, tracking, refunds, labels": "Revisa envíos, rastreo, reembolsos y etiquetas",
  "Import CSV, edit addresses, merge duplicates": "Importa CSV, edita direcciones, combina duplicados",
  "Combine selected purchased labels into one PDF": "Junta las etiquetas compradas seleccionadas en un PDF",
  "See what's packed and what's left this week": "Mira qué está empacado y qué falta esta semana",
  "Scan packed labels, snap a photo, message the customer": "Escanea etiquetas empacadas, toma una foto, avísale al cliente",
  "Reprint a smudged label, void a mistake, or log a package that came back.":
    "Reimprime una etiqueta manchada, anula un error o registra un paquete que regresó.",
  "Shipments will show up here once you buy your first label.": "Los envíos aparecerán aquí cuando compres tu primera etiqueta.",
  "No orders yet. Create a label to get started.": "Aún no hay pedidos. Crea una etiqueta para empezar.",
  "View all": "Ver todo",
  "Open full map →": "Abrir mapa completo →",
  "Where your packages go": "A dónde van tus paquetes",
  "Couldn't load shipments.": "No se pudieron cargar los envíos.",

  // ---------- Ship day card ----------
  "Checking the forecast…": "Revisando el pronóstico…",
  "Forecast unavailable right now": "Pronóstico no disponible por ahora",
  "Closed that day": "Cerrado ese día",
  "Holiday this week": "Feriado esta semana",
  "Normal service": "Servicio normal",
  "Not packed yet": "Sin empacar",
  "Heads up this week": "Avisos de esta semana",
  "All clear: no USPS holidays and no bad weather where your packages are headed.":
    "Todo bien: no hay feriados de USPS ni mal clima a donde van tus paquetes.",
  "USPS holiday": "Feriado de USPS",
  "Post offices are closed on your ship day. Drop packages off Friday or schedule them for the next business day.":
    "Las oficinas de correo cierran tu día de envío. Deja los paquetes el viernes o prográmalos para el siguiente día hábil.",
  "No USPS delivery that day. Packages keep moving the next business day, so some may land a day later.":
    "USPS no entrega ese día. Los paquetes siguen el siguiente día hábil, así que algunos pueden llegar un día después.",
  "Worth a heads-up to bring it inside quickly.": "Vale la pena avisarles que lo metan rápido.",
  "Poly mailers hold up fine; paper boxes can get soaked on a porch.":
    "Las bolsas de plástico aguantan bien; las cajas de cartón se pueden mojar en el porche.",
  "Snow or ice can slow delivery a day.": "La nieve o el hielo pueden retrasar la entrega un día.",
  "Sunny": "Soleado",
  "Mostly sunny": "Mayormente soleado",
  "Cloudy": "Nublado",
  "Foggy": "Neblina",
  "Drizzle": "Llovizna",
  "Rain": "Lluvia",
  "Snow": "Nieve",
  "Showers": "Chubascos",
  "Snow showers": "Nevadas",
  "Thunderstorms": "Tormentas",
  "no rain": "sin lluvia",

  // Holidays
  "New Year's Day": "Año Nuevo",
  "Martin Luther King Jr. Day": "Día de Martin Luther King Jr.",
  "Presidents' Day": "Día de los Presidentes",
  "Memorial Day": "Día de los Caídos",
  "Juneteenth": "Juneteenth",
  "Independence Day": "Día de la Independencia",
  "Independence Day (observed)": "Día de la Independencia (observado)",
  "Labor Day": "Día del Trabajo",
  "Columbus Day": "Día de la Raza",
  "Veterans Day": "Día de los Veteranos",
  "Thanksgiving": "Día de Acción de Gracias",
  "Christmas": "Navidad",

  // Days and months on their own
  "Monday": "Lunes",
  "Tuesday": "Martes",
  "Wednesday": "Miércoles",
  "Thursday": "Jueves",
  "Friday": "Viernes",
  "Saturday": "Sábado",
  "Sunday": "Domingo",

  // ---------- Common words & buttons ----------
  "All": "Todos",
  "all": "todos",
  "Active": "Activos",
  "Admin": "Admin",
  "App": "App",
  "Back": "Atrás",
  "Buy": "Comprar",
  "Buying…": "Comprando…",
  "By": "Por",
  "Cancel": "Cancelar",
  "Change": "Cambiar",
  "Checking…": "Revisando…",
  "checking...": "revisando...",
  "Close": "Cerrar",
  "Code": "Código",
  "Color": "Color",
  "Contact": "Contacto",
  "Copied": "Copiado",
  "Copied ✓": "Copiado ✓",
  "Copied!": "¡Copiado!",
  "Date": "Fecha",
  "Date range": "Rango de fechas",
  "Delete": "Eliminar",
  "Deleting...": "Eliminando...",
  "Description": "Descripción",
  "Dimensions": "Medidas",
  "Dismiss": "Descartar",
  "Done": "Listo",
  "Download": "Descargar",
  "Download CSV": "Descargar CSV",
  "Download PDF": "Descargar PDF",
  "Email": "Correo",
  "Find": "Buscar",
  "Fit": "Ajustar",
  "Generating…": "Generando…",
  "History": "Historial",
  "Keep": "Conservar",
  "Loading…": "Cargando…",
  "Location": "Ubicación",
  "Making…": "Haciendo…",
  "Manual": "Manual",
  "Method": "Método",
  "Name": "Nombre",
  "Notes": "Notas",
  "Now:": "Ahora:",
  "On": "Activado",
  "Open": "Abrir",
  "Open it": "Abrirlo",
  "Opening...": "Abriendo...",
  "Opening…": "Abriendo…",
  "Other": "Otro",
  "Password": "Contraseña",
  "Phone": "Teléfono",
  "Print": "Imprimir",
  "Printed": "Impresa",
  "Reason": "Motivo",
  "Receipt": "Recibo",
  "Recommended": "Recomendada",
  "Ref": "Ref.",
  "Required": "Obligatorio",
  "Not required": "No es necesario",
  "Retake": "Repetir",
  "Save changes": "Guardar cambios",
  "Saving…": "Guardando…",
  "Saving failed.": "No se pudo guardar.",
  "Couldn't save.": "No se pudo guardar.",
  "Select": "Seleccionar",
  "Select all": "Seleccionar todo",
  "select all": "seleccionar todo",
  "Selected": "Seleccionados",
  "selected": "seleccionados",
  "Send": "Enviar",
  "Sent": "Enviado",
  "Sent today": "Enviado hoy",
  "Show more": "Mostrar más",
  "Showing": "Mostrando",
  "shown": "mostrados",
  "orders shown": "pedidos mostrados",
  "label": "etiqueta",
  "day": "día",
  "days": "días",
  "event": "evento",
  "3 months": "3 meses",
  "Auto-fill": "Autocompletar",
  "Setting up…": "Preparando…",
  "Shipping Method": "Método de envío",
  "Insured $": "Asegurado por $",
  "Updates automatically · last checked": "Se actualiza solo · última revisión",
  ". Send it yourself below.": ". Envíalo tú abajo.",
  "of": "de",
  "on": "el",
  "in": "en",
  "Something went wrong.": "Algo salió mal.",
  "Status": "Estado",
  "Total": "Total",
  "Try again": "Intentar de nuevo",
  "Undo": "Deshacer",
  "Unknown": "Desconocido",
  "unknown": "desconocido",
  "Unselect": "Quitar selección",
  "Update": "Actualizar",
  "Used": "Usado",
  "View": "Ver",
  "Why?": "¿Por qué?",
  "Nothing yet.": "Nada todavía.",
  "No matches.": "Sin resultados.",
  "Not found": "No encontrado",
  "Lookup failed.": "La búsqueda falló.",
  "Clear search": "Borrar búsqueda",
  "✕ Clear": "✕ Borrar",
  "(optional)": "(opcional)",
  "Instructions": "Instrucciones",
  "Footer": "Pie de página",
  "Branded logo": "Logo de la marca",

  // ---------- Statuses (as they appear on pills) ----------
  "Draft": "Borrador",
  "draft": "borrador",
  "Drafts": "Borradores",
  "purchased": "comprada",
  "Purchased": "Comprada",
  "refunded": "reembolsada",
  "Refunded": "Reembolsada",
  "Refunding...": "Reembolsando...",
  "Voided": "Anulada",
  "voided": "anulada",
  "submitted": "solicitado",
  "rejected": "rechazado",
  "pending": "pendiente",
  "Pending": "Pendiente",
  "Paid": "Pagado",
  "Packed": "Empacado",
  "packed": "empacado",
  "Not packed": "Sin empacar",
  "Delivered": "Entregado",
  "delivered": "entregado",
  "Not delivered yet": "Aún no entregado",
  "Received": "Recibida",
  "received": "recibida",
  "waiting": "en espera",
  "done": "terminada",
  "flagged": "marcado",
  "printed": "impresa",
  "Not printed yet": "Aún sin imprimir",
  "Unclaimed": "No reclamado",
  "Refused": "Rechazado",
  "Bad address": "Dirección incorrecta",

  // ---------- Create label ----------
  "Shipping provider": "Proveedor de envío",
  "Provider": "Proveedor",
  "Ship to": "Enviar a",
  "Ship To:": "Enviar a:",
  "Shipping address": "Dirección de envío",
  "Search existing customers by name, email or phone": "Busca clientes por nombre, correo o teléfono",
  "Start typing an address": "Empieza a escribir una dirección",
  "Enter address manually": "Escribir la dirección a mano",
  "Edit address details": "Editar detalles de la dirección",
  "Address details": "Detalles de la dirección",
  "Address": "Dirección",
  "Street": "Calle",
  "Apt / Suite": "Depto. / Suite",
  "Apt / Suite (optional)": "Depto. / Suite (opcional)",
  "City": "Ciudad",
  "State": "Estado",
  "States": "Estados",
  "ZIP": "C.P.",
  "Powered by Google": "Con tecnología de Google",
  "Package": "Paquete",
  "Package type": "Tipo de paquete",
  "My Packaging": "Mi empaque",
  "Custom box": "Caja personalizada",
  "Envelope #10": "Sobre #10",
  "#10 Envelope": "Sobre #10",
  "Box (inches)": "Caja (pulgadas)",
  "Length": "Largo",
  "Width": "Ancho",
  "Height": "Alto",
  "Weight": "Peso",
  "Pounds": "Libras",
  "Ounces": "Onzas",
  "Use weight": "Usar peso",
  "Reset to my box (14 × 17 × 1)": "Volver a mi caja (14 × 17 × 1)",
  "Box size changed": "Cambió el tamaño de la caja",
  "Reference #": "Referencia #",
  "Defaults to the order number.": "Si lo dejas vacío, se usa el número de pedido.",
  "(prints on label)": "(se imprime en la etiqueta)",
  "Add insurance": "Agregar seguro",
  "Insure this package": "Asegurar este paquete",
  "Value of what's inside, e.g. 120": "Valor del contenido, p. ej. 120",
  "Enter how much to insure it for.": "Escribe por cuánto asegurarlo.",
  "Require signature": "Pedir firma",
  "Signature": "Firma",
  "Get rates": "Ver tarifas",
  "Get new rates": "Ver tarifas nuevas",
  "Get rates first": "Primero ve las tarifas",
  "Getting rates…": "Buscando tarifas…",
  "Refresh rates": "Actualizar tarifas",
  "Pick a rate": "Elige una tarifa",
  "Select a rate": "Selecciona una tarifa",
  "Pick a rate, then buy on the right": "Elige una tarifa y luego compra a la derecha",
  "Pick a rate, then press Buy.": "Elige una tarifa y luego presiona Comprar.",
  "Clicking a rate buys the label right away.": "Al hacer clic en una tarifa, la etiqueta se compra de inmediato.",
  "One-click purchase": "Compra en un clic",
  "One-click is on — clicking a rate buys it": "Compra en un clic activada: al tocar una tarifa se compra",
  "Tap a rate to purchase the label. Scan-based rates only bill when the label is used.":
    "Toca una tarifa para comprar la etiqueta. Las tarifas por escaneo solo se cobran cuando se usa la etiqueta.",
  "Add the address and weight, then get rates to see your shipping options here.":
    "Agrega la dirección y el peso, y luego busca tarifas para ver aquí tus opciones de envío.",
  "Enter a full address and a weight above 0.": "Escribe una dirección completa y un peso mayor a 0.",
  "No rates returned — check the address and weight.": "No salieron tarifas: revisa la dirección y el peso.",
  "No rates came back. Check the weight and box size.": "No salieron tarifas. Revisa el peso y el tamaño de la caja.",
  "Couldn't get rates.": "No se pudieron obtener las tarifas.",
  "Couldn't make the label.": "No se pudo hacer la etiqueta.",
  "Fastest": "La más rápida",
  "Estimate n/a": "Sin estimado",
  "Save draft": "Guardar borrador",
  "Update draft": "Actualizar borrador",
  "Drafts can be continued later from the Orders page.": "Puedes continuar los borradores después desde la página de Pedidos.",
  "Clear and start over": "Borrar y empezar de nuevo",
  "Continue label": "Continuar etiqueta",
  "Label Preview": "Vista previa de la etiqueta",
  "Envelope Preview": "Vista previa del sobre",
  "Barcode added when you buy": "El código de barras se agrega al comprar",
  "AFTER RATE": "DESPUÉS DE LA TARIFA",
  "First-Class letter · no tracking": "Carta First-Class · sin rastreo",
  "9½ × 4⅛ in · letter": "9½ × 4⅛ pulg · carta",
  "14 × 17 × 1 in": "14 × 17 × 1 pulg",
  "This is a re-ship of a package that came back.": "Este es un reenvío de un paquete que regresó.",
  "Opens Create Label with the same customer and package filled in.":
    "Abre Crear etiqueta con el mismo cliente y paquete ya llenos.",
  "Label size": "Tamaño de la etiqueta",
  "Service, weight, insurance": "Servicio, peso, seguro",
  "Faster service": "Servicio más rápido",
  "How fast it gets there": "Qué tan rápido llega",
  "Wrong weight, box or service.": "Peso, caja o servicio equivocado.",
  "Weight was wrong": "El peso estaba mal",

  // ---------- Scale ----------
  "⚖️ USB scale": "⚖️ Báscula USB",
  "⚖️ To use your USB scale, open the portal in Chrome or Edge.": "⚖️ Para usar tu báscula USB, abre el portal en Chrome o Edge.",
  "Connect scale": "Conectar báscula",
  "Disconnect": "Desconectar",
  "Scale not in the list? Show all USB devices": "¿No aparece la báscula? Mostrar todos los dispositivos USB",
  "Waiting for the scale…": "Esperando la báscula…",
  "Turn the scale on first.": "Primero prende la báscula.",
  "Place package": "Coloca el paquete",
  "Settling…": "Estabilizando…",
  "Stable": "Estable",
  "Below zero, press Zero on the scale": "Debajo de cero, presiona Zero en la báscula",
  "Too heavy for the scale": "Demasiado pesado para la báscula",
  "Scale error": "Error de la báscula",
  "No scale was picked.": "No se eligió ninguna báscula.",
  "No device was picked.": "No se eligió ningún dispositivo.",
  "Couldn't open the scale. Unplug it, plug it back in, and try again.":
    "No se pudo abrir la báscula. Desconéctala, vuelve a conectarla e inténtalo de nuevo.",
  "POS scale": "Báscula POS",

  // ---------- Batch print ----------
  "To print": "Por imprimir",
  "Saved PDFs": "PDF guardados",
  "Print label": "Imprimir etiqueta",
  "Mark printed after": "Marcar como impresas después",
  "Merging…": "Uniendo…",
  "Nothing to print": "Nada que imprimir",
  "Nothing printed yet.": "Aún no se ha impreso nada.",
  "All caught up — no purchased labels waiting to print.": "Todo al día: no hay etiquetas compradas esperando impresión.",
  "No saved PDFs yet. Every batch you print from now on will show up here.":
    "Aún no hay PDF guardados. Cada lote que imprimas desde ahora aparecerá aquí.",
  "Pop-up blocked — allow pop-ups for this site to open PDFs.": "Ventana bloqueada: permite ventanas emergentes en este sitio para abrir los PDF.",
  "Pop-up blocked — allow pop-ups for this site to open merged PDFs.":
    "Ventana bloqueada: permite ventanas emergentes en este sitio para abrir los PDF unidos.",
  "Printed, but the PDF copy couldn't be saved to Saved PDFs.": "Se imprimió, pero la copia del PDF no se pudo guardar en PDF guardados.",
  "Saving batch PDF failed": "No se pudo guardar el PDF del lote",
  "Couldn't download that PDF.": "No se pudo descargar ese PDF.",
  "Couldn't load that PDF.": "No se pudo cargar ese PDF.",
  "Couldn't open that PDF.": "No se pudo abrir ese PDF.",
  "Couldn't load orders.": "No se pudieron cargar los pedidos.",
  "Mark unprinted": "Marcar sin imprimir",
  "Reprint": "Reimprimir",
  "Oldest first": "Más antiguos primero",
  "Label opened. Print it from the new tab.": "Etiqueta abierta. Imprímela desde la pestaña nueva.",

  // ---------- Packing list ----------
  "To pack": "Por empacar",
  "Pack": "Empacar",
  "Mark packed": "Marcar empacado",
  "Packing day": "Día de empaque",
  "This week": "Esta semana",
  "Last 14 days": "Últimos 14 días",
  "This month": "Este mes",
  "This year": "Este año",
  "All time": "Todo",
  "left ·": "pendientes ·",
  "customers told": "clientes avisados",
  "Customer told": "Cliente avisado",
  "Customer told it's on the way": "Se le avisó al cliente que va en camino",
  "Everything is packed. 🎉": "Todo está empacado. 🎉",
  "Nothing left to pack.": "No queda nada por empacar.",
  "Nice and tidy.": "Todo en orden.",
  "Couldn't load the packing list.": "No se pudo cargar la lista de empaque.",
  "Muse couldn't send": "Muse no pudo enviar",
  "Muse couldn't send this one": "Muse no pudo enviar este",
  "Tap to see them and send by hand.": "Tócalo para verlos y enviarlos a mano.",
  "Muse flagged": "Muse lo marcó",
  "Queued for Muse": "En cola para Muse",
  "Queued for Muse ✓": "En cola para Muse ✓",
  "Waiting for Muse to send it": "Esperando que Muse lo envíe",
  "Adding to Muse queue…": "Agregando a la cola de Muse…",
  "Send with Muse": "Enviar con Muse",
  "Muse will send the photo and message next time it runs. Anything it can't match shows up as flagged on the Packing List.":
    "Muse enviará la foto y el mensaje la próxima vez que corra. Lo que no pueda encontrar aparecerá marcado en la Lista de empaque.",
  ". Sending it yourself now is fine too; Muse will skip it.": ". También puedes enviarlo tú ahora; Muse lo saltará.",
  "Show everyone": "Mostrar a todos",
  "Search name, EB number or city": "Busca nombre, número EB o ciudad",
  "Search name, city, EB #": "Busca nombre, ciudad, EB #",

  // ---------- Packing slips ----------
  "Slip size": "Tamaño de la nota",
  "Slip text": "Texto de la nota",
  "Full page": "Página completa",
  "Half page": "Media página",
  "Letter": "Carta",
  "letter": "carta",
  "Show returns line": "Mostrar línea de devoluciones",
  "Returns line": "Línea de devoluciones",
  "Thank-you message · English": "Mensaje de agradecimiento · Inglés",
  "Thank-you message · Español": "Mensaje de agradecimiento · Español",
  "Reset to default text": "Volver al texto original",
  "Blank lines when no items are listed": "Líneas en blanco si no hay artículos",
  "Show service & tracking": "Mostrar servicio y rastreo",
  "Pick an order to preview its slip.": "Elige un pedido para ver su nota.",
  "Preview ·": "Vista previa ·",
  "What's in": "Lo que va en el paquete de",
  "'s package": "",
  "One per line": "Uno por línea",
  "No items": "Sin artículos",
  "Missing items": "Faltan artículos",
  "Select orders to make slips": "Selecciona pedidos para hacer notas",
  "Make PDF": "Hacer PDF",
  "Making PDF…": "Haciendo PDF…",
  "PDF for this order": "PDF de este pedido",
  "Run sql/packing_slips.sql in Supabase first, then items will save.":
    "Primero corre sql/packing_slips.sql en Supabase y luego se guardarán los artículos.",
  "One-time setup: run": "Configuración única: corre",
  "One-time setup needed: run": "Hace falta una configuración única: corre",
  "in Supabase so the items you type are saved with each order.":
    "en Supabase para que los artículos que escribas se guarden con cada pedido.",
  ". Saving again updates it.": ". Si guardas de nuevo, se actualiza.",
  "Inside every box": "En cada caja",
  "En tu paquete · In your package": "En tu paquete · In your package",

  // ---------- Scan & Send ----------
  "Scan label": "Escanear etiqueta",
  "Line up the long barcode inside the frame": "Alinea el código de barras largo dentro del marco",
  "Hold the long barcode across the box, about 6 inches away.": "Sostén el código largo a lo ancho del recuadro, a unas 6 pulgadas.",
  "Starting camera…": "Abriendo cámara…",
  "Reading barcode…": "Leyendo código…",
  "Finding order…": "Buscando pedido…",
  "Turn flashlight on": "Prender linterna",
  "Turn flashlight off": "Apagar linterna",
  "Photo of label": "Foto de la etiqueta",
  "Not scanning? Take a photo of the label": "¿No escanea? Toma una foto de la etiqueta",
  "Or type tracking or EB-123": "O escribe el rastreo o EB-123",
  "Tracking # or EB-123": "Rastreo # o EB-123",
  "Camera access is blocked. Allow the camera for this site in your browser settings, or use Photo of label.":
    "El acceso a la cámara está bloqueado. Permite la cámara para este sitio en tu navegador, o usa Foto de la etiqueta.",
  "Couldn't start the camera. Use Photo of label instead.": "No se pudo abrir la cámara. Usa Foto de la etiqueta.",
  "Couldn't start the camera. Use Photo of label, or type the number below.":
    "No se pudo abrir la cámara. Usa Foto de la etiqueta o escribe el número abajo.",
  "This browser can't use the camera. Use Photo of label instead.": "Este navegador no puede usar la cámara. Usa Foto de la etiqueta.",
  "This browser can't use the camera. Use Photo of label, or type the number below.":
    "Este navegador no puede usar la cámara. Usa Foto de la etiqueta o escribe el número abajo.",
  "Couldn't find a barcode in that photo. Get closer so the barcode fills the photo, and hold steady.":
    "No se encontró un código de barras en esa foto. Acércate para que el código llene la foto y no te muevas.",
  "Couldn't find a barcode in that photo. Get closer so the barcode fills the photo.":
    "No se encontró un código de barras en esa foto. Acércate para que el código llene la foto.",
  "Couldn't read that photo. Try again, or type the number below.": "No se pudo leer esa foto. Inténtalo de nuevo o escribe el número abajo.",
  "Couldn't read that photo. Try again.": "No se pudo leer esa foto. Inténtalo de nuevo.",
  "The barcode reader couldn't load. Check your connection, or type the number below.":
    "El lector de códigos no cargó. Revisa tu conexión o escribe el número abajo.",
  "The barcode reader couldn't load. Check your connection.": "El lector de códigos no cargó. Revisa tu conexión.",
  "Couldn't look that up. Check your connection and try again.": "No se pudo buscar. Revisa tu conexión e inténtalo de nuevo.",
  "No order matches that label.": "Ningún pedido coincide con esa etiqueta.",
  "Label found": "Etiqueta encontrada",
  "Not this one, scan again": "No es este, escanear otra vez",
  "Back to scanning": "Volver a escanear",
  "Step 2 · Photo & send": "Paso 2 · Foto y envío",
  "Customer": "Cliente",
  "customer": "cliente",
  "Already sent by": "Ya se envió por",
  "Take a photo of the box": "Toma una foto de la caja",
  "Take a photo of the package first.": "Primero toma una foto del paquete.",
  "Package photo": "Foto del paquete",
  "Retake photo": "Repetir foto",
  "Preparing photo…": "Preparando foto…",
  "Photo saved": "Foto guardada",
  "Open in": "Abrir en",
  "Messenger": "Messenger",
  "Business Suite": "Business Suite",
  "Send to Messenger": "Enviar a Messenger",
  "Copies the photo and opens": "Copia la foto y abre",
  ". In the chat, press and hold the message box and tap Paste.": ". En el chat, mantén presionado el cuadro de mensaje y toca Pegar.",
  "Now paste the photo": "Ahora pega la foto",
  "Press and hold the message box, tap Paste, and send the photo.": "Mantén presionado el cuadro de mensaje, toca Pegar y envía la foto.",
  "Come back here, tap Copy message, and paste that too.": "Regresa aquí, toca Copiar mensaje y pega eso también.",
  "Messenger only sends the photo. The message is already copied: in the chat, press and hold the message box and tap Paste.":
    "Messenger solo envía la foto. El mensaje ya está copiado: en el chat, mantén presionado el cuadro de mensaje y toca Pegar.",
  "This phone didn't let the photo be copied. Use Share photo below instead.":
    "Este teléfono no dejó copiar la foto. Usa Compartir foto abajo.",
  "Sharing didn't open. Use Copy message and Save photo instead.": "No se abrió compartir. Usa Copiar mensaje y Guardar foto.",
  "Message & other options": "Mensaje y otras opciones",
  "Copy message": "Copiar mensaje",
  "Copy again": "Copiar de nuevo",
  "Message copied": "Mensaje copiado",
  "Message copied ✓": "Mensaje copiado ✓",
  "Share message": "Compartir mensaje",
  "Share photo": "Compartir foto",
  "Share photo and message": "Compartir foto y mensaje",
  "Save photo": "Guardar foto",
  "Save photo only": "Guardar solo la foto",
  "Email instead": "Mejor por correo",
  "Sending email…": "Enviando correo…",
  "Email sent": "Correo enviado",
  "Mark as sent": "Marcar como enviado",
  "Marked by mistake? Undo": "¿Lo marcaste por error? Deshacer",
  "Scan next": "Escanear siguiente",
  "Scan next package": "Escanear siguiente paquete",
  "Scan next label": "Escanear siguiente etiqueta",
  "Track package": "Rastrear paquete",

  // ---------- Orders ----------
  "Search orders": "Buscar pedidos",
  "Search name, EB number, tracking, city...": "Busca nombre, número EB, rastreo, ciudad...",
  "Loading orders…": "Cargando pedidos…",
  "Loading all orders…": "Cargando todos los pedidos…",
  "No orders match.": "Ningún pedido coincide.",
  "No orders in this range.": "No hay pedidos en este rango.",
  "Order": "Pedido",
  "Order date": "Fecha del pedido",
  "Order notes": "Notas del pedido",
  "Order Actions": "Acciones del pedido",
  "Open order": "Abrir pedido",
  "Open order →": "Abrir pedido →",
  "Untitled order": "Pedido sin nombre",
  "Back to Orders": "Volver a Pedidos",
  "Loading order...": "Cargando pedido...",
  "This order doesn't exist or was deleted.": "Este pedido no existe o se eliminó.",
  "Recipient": "Destinatario",
  "Carrier": "Paquetería",
  "Service": "Servicio",
  "Tracking": "Rastreo",
  "Tracking #": "Rastreo #",
  "Tracking number": "Número de rastreo",
  "Tracking number or order number": "Número de rastreo o de pedido",
  "Postage": "Envío",
  "Postage spent": "Gastado en envíos",
  "Postage Spent": "Gastado en envíos",
  "Purchased postage": "Envíos comprados",
  "Created": "Creado",
  "Bought": "Comprada",
  "Label": "Etiqueta",
  "Label & tracking": "Etiqueta y rastreo",
  "Print return label": "Imprimir etiqueta de devolución",
  "Copy tracking": "Copiar rastreo",
  "Copy tracking number": "Copiar número de rastreo",
  "Copy tracking link": "Copiar enlace de rastreo",
  "Tracking link copied to clipboard.": "Enlace de rastreo copiado.",
  "Copy notification": "Copiar aviso",
  "Notification copied to clipboard.": "Aviso copiado.",
  "Copy portal link": "Copiar enlace del portal",
  "Portal link copied to clipboard.": "Enlace del portal copiado.",
  "✓ Link copied": "✓ Enlace copiado",
  "Copy this link:": "Copia este enlace:",
  "Cancel / refund label": "Cancelar / reembolsar etiqueta",
  "Refund": "Reembolso",
  "Refund submitted to the carrier.": "Reembolso enviado a la paquetería.",
  "The carrier didn't accept the refund.": "La paquetería no aceptó el reembolso.",
  "Delete order": "Eliminar pedido",
  "Payment": "Pago",
  "Amount": "Monto",
  "View receipt": "Ver recibo",
  "Looking for a matching payment in the billing portal...": "Buscando un pago que coincida en el portal de cobros...",
  "No matching payment found in the billing portal. This order was likely paid manually (cash, in-person, or outside Stripe).":
    "No se encontró un pago en el portal de cobros. Seguramente este pedido se pagó a mano (efectivo, en persona o fuera de Stripe).",
  "Redirecting...": "Redirigiendo...",
  "Basket #": "Canasta #",
  "From this week's live — shows tracking on their portal.": "Del live de esta semana: muestra el rastreo en su portal.",
  "Full details": "Todos los detalles",
  "Edit details below": "Edita los detalles abajo",
  "See the original order": "Ver el pedido original",

  // ---------- Customers ----------
  "Add customer": "Agregar cliente",
  "Edit customer": "Editar cliente",
  "Import CSV": "Importar CSV",
  "Import failed.": "La importación falló.",
  "That CSV appears to be empty.": "Ese CSV parece estar vacío.",
  "Find duplicates": "Buscar duplicados",
  "Merge duplicates": "Combinar duplicados",
  "Search name, email, phone, city or ZIP": "Busca nombre, correo, teléfono, ciudad o C.P.",
  "Loading your directory…": "Cargando tu directorio…",
  "No customers yet": "Aún no hay clientes",
  "Add your first customer or import a CSV to get started.": "Agrega tu primer cliente o importa un CSV para empezar.",
  "No customers match": "Ningún cliente coincide",
  "this filter": "con este filtro",
  "Jump to letter": "Ir a la letra",
  "No address": "Sin dirección",
  "No address yet": "Aún sin dirección",
  "No address on file": "No hay dirección guardada",
  "Missing address": "Falta dirección",
  "Missing email": "Falta correo",
  "No contact info": "Sin datos de contacto",
  "+ Add address": "+ Agregar dirección",
  "+ Add email": "+ Agregar correo",
  "Customer notes": "Notas del cliente",
  "Gift wrap preferences, sizing, anything worth remembering…": "Preferencias de regalo, tallas, lo que valga la pena recordar…",
  "Name is required.": "El nombre es obligatorio.",
  "Customer deleted.": "Cliente eliminado.",
  "Lifetime shipments": "Envíos en total",
  "Lifetime spend": "Gasto total",
  "Last shipped": "Último envío",
  "No orders found for this customer yet.": "Aún no hay pedidos para este cliente.",
  "No duplicates detected": "No se encontraron duplicados",
  "Matched by email, phone, name + ZIP, or address. Merged duplicates are archived — never deleted.":
    "Se comparan por correo, teléfono, nombre + C.P. o dirección. Los duplicados combinados se archivan, nunca se eliminan.",
  "Pick the main record": "Elige el registro principal",
  "The others are archived and their orders move to the one you keep.":
    "Los demás se archivan y sus pedidos pasan al que conserves.",
  "Same email": "Mismo correo",
  "Same phone": "Mismo teléfono",
  "Same name + ZIP": "Mismo nombre + C.P.",
  "Same address": "Misma dirección",
  "Top customers": "Mejores clientes",

  // ---------- Returns ----------
  "Search returns": "Buscar devoluciones",
  "Search name, code or tracking": "Busca nombre, código o rastreo",
  "Scan a return": "Escanear una devolución",
  "Scan return": "Escanear devolución",
  "No return matches that label.": "Ninguna devolución coincide con esa etiqueta.",
  "No return requests yet.": "Aún no hay solicitudes de devolución.",
  "No returns match.": "Ninguna devolución coincide.",
  "Needs a label": "Necesita etiqueta",
  "Needs label": "Necesita etiqueta",
  "Needs a nudge": "Hay que recordarle",
  "Label sent": "Etiqueta enviada",
  "Label sent, not back yet": "Etiqueta enviada, aún no regresa",
  "Waiting on customer": "Esperando al cliente",
  "Back at the boutique": "Ya en la boutique",
  "Already received": "Ya recibida",
  "Receive": "Recibir",
  "Receive return": "Recibir devolución",
  "Mark received": "Marcar recibida",
  "Mark done": "Marcar terminada",
  "Move back to Received": "Regresar a Recibidas",
  "Moved back to Received.": "Se regresó a Recibidas.",
  "Choose a return rate": "Elige una tarifa de devolución",
  "Return code": "Código de devolución",
  "Copy return code": "Copiar código de devolución",
  "Copy code": "Copiar código",
  "New return access code": "Nuevo código de acceso para devoluciones",
  "Hide new code": "Ocultar código nuevo",
  "Recent access codes": "Códigos de acceso recientes",
  "No codes generated yet.": "Aún no se han generado códigos.",
  "Request came in": "Llegó la solicitud",
  "Customer's reason": "Motivo del cliente",
  "No reason": "Sin motivo",
  "No reason given": "No dio motivo",
  "Condition": "Estado",
  "Like new": "Como nuevo",
  "Worn / used": "Usado",
  "Damaged": "Dañado",
  "Damaged in transit": "Dañado en el camino",
  "Too big": "Muy grande",
  "Too small": "Muy chico",
  "Wrong item": "Artículo equivocado",
  "Returned item": "Artículo devuelto",
  "Pick the item's condition.": "Elige el estado del artículo.",
  "Edit condition / photo": "Editar estado / foto",
  "Photo of the item": "Foto del artículo",
  "Take photo (optional)": "Tomar foto (opcional)",
  "No photo": "Sin foto",
  "Tags still on, small stain on sleeve…": "Todavía con etiquetas, manchita en la manga…",
  "Received this month": "Recibidas este mes",
  "No returns this month.": "No hubo devoluciones este mes.",

  // ---------- Scan a label (label tools) ----------
  "Find another label": "Buscar otra etiqueta",
  "Scan to open order": "Escanear para abrir el pedido",
  "Fix a label": "Arreglar una etiqueta",
  "Reprint label": "Reimprimir etiqueta",
  "Same label, no charge · press P": "Misma etiqueta, sin costo · presiona P",
  "Smudged or lost label. Free.": "Etiqueta manchada o perdida. Gratis.",
  "Change & rebuy": "Cambiar y volver a comprar",
  "Void & refund": "Anular y reembolsar",
  "Voiding…": "Anulando…",
  "Only before USPS scans it": "Solo antes de que USPS la escanee",
  "Only before the post office scans it.": "Solo antes de que el correo la escanee.",
  "Already voided": "Ya anulada",
  "Came back": "Regresó",
  "Returned to sender": "Devuelto al remitente",
  "Returned to sender. Log it and reship.": "Devuelto al remitente. Regístralo y reenvíalo.",
  "Mark returned": "Marcar devuelto",
  "Marked as returned to sender.": "Marcado como devuelto al remitente.",
  "Why did it come back?": "¿Por qué regresó?",
  "Pick why it came back.": "Elige por qué regresó.",
  "Note (optional): e.g. 'Attempted, no such number'": "Nota (opcional): p. ej. 'Intento fallido, no existe ese número'",
  "Re-ship": "Reenviar",
  "Re-ship started:": "Reenvío iniciado:",
  "new order": "pedido nuevo",
  "Fix address & re-ship": "Corregir dirección y reenviar",
  "1. Ask the customer to confirm their address": "1. Pídele al cliente que confirme su dirección",
  "2. Send it again": "2. Envíalo de nuevo",
  "Copy message (ES + EN)": "Copiar mensaje (ES + EN)",
  "Can you confirm your address? We have:": "Can you confirm your address? We have:",
  "Add a note": "Agregar una nota",
  "Note about this package": "Nota sobre este paquete",
  "e.g. Left with neighbor, customer asked to hold": "p. ej. Se dejó con el vecino, el cliente pidió guardarlo",
  "Save note": "Guardar nota",
  "Saves to the order and": "Se guarda en el pedido y en el perfil de",
  "'s profile": "",
  "the customer": "el cliente",
  "Note saved to the customer's profile and this order.": "Nota guardada en el perfil del cliente y en este pedido.",
  "Note saved to this order (no customer profile is linked).": "Nota guardada en este pedido (no tiene perfil de cliente).",
  "Pick the new label": "Elige la etiqueta nueva",
  "(same as now)": "(igual que ahora)",
  "The new label is bought first. Only then is the old one voided and refunded, and the order keeps its EB number.":
    "Primero se compra la etiqueta nueva. Solo después se anula y reembolsa la anterior, y el pedido conserva su número EB.",
  "The insurance cost is added to the new label's price when you buy it.":
    "El costo del seguro se suma al precio de la etiqueta nueva al comprarla.",
  "Couldn't buy the new label.": "No se pudo comprar la etiqueta nueva.",
  "Label replaced": "Etiqueta reemplazada",
  "Replaced labels": "Etiquetas reemplazadas",
  "Label found ·": "Etiqueta encontrada ·",
  "More actions": "Más acciones",
  "Shipment archive": "Archivo de envíos",
  "Unknown error": "Error desconocido",
  "unknown error": "error desconocido",

  // ---------- Map ----------
  "Loading map…": "Cargando mapa…",
  "Map of where packages were shipped": "Mapa de a dónde se enviaron los paquetes",
  "The map couldn't load. Check your connection and refresh.": "El mapa no cargó. Revisa tu conexión y actualiza.",
  "Tap a dot to see the city.": "Toca un punto para ver la ciudad.",
  "Top city": "Ciudad principal",
  "Top cities": "Ciudades principales",
  "Top states": "Estados principales",
  "had a ZIP code that couldn't be placed on the map.": "tenía un C.P. que no se pudo ubicar en el mapa.",
  "in this time range": "en este rango de tiempo",
  "No labels in this time range yet.": "Aún no hay etiquetas en este rango de tiempo.",
  "No shipments in this range yet.": "Aún no hay envíos en este rango.",
  "Packages": "Paquetes",
  "packages": "paquetes",
  "package": "paquete",
  "Avg per package": "Promedio por paquete",

  // ---------- Carrier performance ----------
  "Update tracking": "Actualizar rastreo",
  "Sign in with Google to update tracking.": "Inicia sesión con Google para actualizar el rastreo.",
  "Tracking update failed.": "No se pudo actualizar el rastreo.",
  "Everything here is already up to date.": "Todo aquí ya está al día.",
  "No delivery dates saved yet. Tap": "Aún no hay fechas de entrega guardadas. Toca",
  "to look them up. It can take a minute the first time.": "para buscarlas. La primera vez puede tardar un minuto.",
  "in Supabase, then tap Update tracking.": "en Supabase y luego toca Actualizar rastreo.",
  "days on average": "días en promedio",
  "No deliveries yet": "Aún no hay entregas",
  "Slowest lately": "La más lenta últimamente",
  "Days to deliver, by state": "Días de entrega, por estado",
  "Most common delivery day": "Día de entrega más común",
  "Shows up once packages have delivery dates.": "Aparece cuando los paquetes tengan fechas de entrega.",
  "No labels bought in this range yet.": "Aún no se compraron etiquetas en este rango.",
  "is both the cheapest and the fastest lately. Easy choice.": "es la más barata y la más rápida últimamente. Fácil decisión.",
  "% of deliveries": "% de las entregas",

  // ---------- Monthly recap ----------
  "Previous month": "Mes anterior",
  "Next month": "Mes siguiente",
  "Packages shipped": "Paquetes enviados",
  "Shipped this month": "Enviados este mes",
  "No packages shipped this month.": "No se enviaron paquetes este mes.",
  "This month hasn't started yet.": "Este mes aún no empieza.",
  "Highlights": "Lo más destacado",
  "Highlights show up once the month has packages.": "Lo destacado aparece cuando el mes tenga paquetes.",
  "Packages each ship day": "Paquetes por día de envío",
  "Biggest day:": "Día más grande:",
  "Where they went": "A dónde fueron",
  "% of packages": "% de los paquetes",

  // ---------- Login ----------
  "Log in": "Iniciar sesión",
  "Continue with Google": "Continuar con Google",
  "Signing in...": "Iniciando sesión...",
  "Show password": "Mostrar contraseña",
  "Hide password": "Ocultar contraseña",
  "Forgot password": "Olvidé mi contraseña",
  "Ask an admin to reset your password.": "Pídele a un admin que restablezca tu contraseña.",
  "Enter your email and password.": "Escribe tu correo y contraseña.",
  "Wrong email or password.": "Correo o contraseña incorrectos.",
  "Invalid login credentials": "Datos de inicio de sesión incorrectos",
  "Staff access only · need an account? Ask an admin.": "Solo para el equipo · ¿necesitas una cuenta? Pídela a un admin.",
  "That account isn’t part of Erendira’s Boutique. Use your work account.":
    "Esa cuenta no es de Erendira’s Boutique. Usa tu cuenta de trabajo.",
  "Welcome Back to Erendira’s Boutique": "Bienvenida de nuevo a Erendira’s Boutique",
  "Illustration of the Erendira's Boutique storefront": "Ilustración de la tienda de Erendira's Boutique",
};

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const MONTH_FULL: Record<string, string> = {
  January: "enero", February: "febrero", March: "marzo", April: "abril", May: "mayo", June: "junio",
  July: "julio", August: "agosto", September: "septiembre", October: "octubre", November: "noviembre", December: "diciembre",
};
const MONTH_SHORT: Record<string, string> = {
  Jan: "ene", Feb: "feb", Mar: "mar", Apr: "abr", May: "may", Jun: "jun",
  Jul: "jul", Aug: "ago", Sep: "sep", Oct: "oct", Nov: "nov", Dec: "dic",
};
const DAY_FULL: Record<string, string> = {
  Monday: "lunes", Tuesday: "martes", Wednesday: "miércoles", Thursday: "jueves", Friday: "viernes", Saturday: "sábado", Sunday: "domingo",
};
const DAY_SHORT: Record<string, string> = {
  Mon: "lun", Tue: "mar", Wed: "mié", Thu: "jue", Fri: "vie", Sat: "sáb", Sun: "dom",
};

const MF = "(January|February|March|April|May|June|July|August|September|October|November|December)";
const MS = "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";
const DF = "(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)";
const DS = "(Mon|Tue|Wed|Thu|Fri|Sat|Sun)";

/** Turns English dates inside a string into Spanish ("Sat, Oct 10" → "sáb, 10 oct"). */
export function spanishDates(s: string): string {
  return s
    .replace(new RegExp("\\b" + MF + " (\\d{1,2}), (\\d{4})\\b", "g"), (_, m, d, y) => d + " de " + MONTH_FULL[m] + " de " + y)
    .replace(new RegExp("\\b" + MF + " (\\d{1,2})\\b", "g"), (_, m, d) => d + " de " + MONTH_FULL[m])
    .replace(new RegExp("\\b" + MF + " (\\d{4})\\b", "g"), (_, m, y) => MONTH_FULL[m] + " de " + y)
    .replace(new RegExp("\\b" + MS + " (\\d{1,2}), (\\d{4})\\b", "g"), (_, m, d, y) => d + " " + MONTH_SHORT[m] + " " + y)
    .replace(new RegExp("\\b" + MS + " (\\d{1,2})\\b", "g"), (_, m, d) => d + " " + MONTH_SHORT[m])
    .replace(new RegExp("\\b" + MS + " (\\d{4})\\b", "g"), (_, m, y) => MONTH_SHORT[m] + " " + y)
    .replace(new RegExp("\\b" + DF + "\\b", "g"), (w) => DAY_FULL[w])
    .replace(new RegExp("\\b" + DS + "\\b", "g"), (w) => DAY_SHORT[w])
    .replace(new RegExp("\\b" + MF + "\\b", "g"), (m) => MONTH_FULL[m]);
}

const DATE_WORDS = new RegExp("\\b(" + [MF, MS, DF, DS].join("|") + "|AM|PM)\\b", "g");

/** True when the text is only a date/time ("Oct 6", "Saturday, Oct 10", "Sat 3:45 PM"). */
function isDateOnly(s: string): boolean {
  const rest = s.replace(DATE_WORDS, "");
  return rest !== s && /^[\d\s,:.·–&/-]*$/.test(rest);
}

/* ------------------------------------------------------------------ */
/* Sentences with numbers or names in them                             */
/* ------------------------------------------------------------------ */

const NOUN: Record<string, [string, string]> = {
  package: ["paquete", "paquetes"],
  order: ["pedido", "pedidos"],
  label: ["etiqueta", "etiquetas"],
  customer: ["cliente", "clientes"],
  day: ["día", "días"],
  item: ["artículo", "artículos"],
  alert: ["aviso", "avisos"],
  slip: ["nota", "notas"],
  state: ["estado", "estados"],
  event: ["evento", "eventos"],
  duplicate: ["duplicado", "duplicados"],
  return: ["devolución", "devoluciones"],
  shipment: ["envío", "envíos"],
};

function noun(n: string, word: string): string {
  const w = word.toLowerCase().replace(/s$/, "");
  const pair = NOUN[w];
  if (!pair) return word;
  return n.replace(/,/g, "") === "1" ? pair[0] : pair[1];
}

function s(text: string): string {
  return translateCore(text) ?? text;
}

type Rule = [RegExp, (m: string[]) => string];

const RULES: Rule[] = [
  // "3 packages", "1 label", "12 Days"
  [/^([\d,]+) (packages?|orders?|labels?|customers?|days?|items?|alerts?|slips?|states?|events?|duplicates?|returns?|shipments?)$/i, (m) => m[1] + " " + noun(m[1], m[2])],
  [/^~([\d,]+) (days?)$/, (m) => "~" + m[1] + " " + noun(m[1], m[2])],
  [/^\+(\d+) more$/, (m) => "+" + m[1] + " más"],

  // Batch print
  [/^Print ([\d,]+) (labels?)$/, (m) => "Imprimir " + m[1] + " " + noun(m[1], m[2])],
  [/^To print · ([\d,]+)$/, (m) => "Por imprimir · " + m[1]],

  // Orders
  [/^All ([\d,]+) orders shown$/, (m) => "Se muestran los " + m[1] + " pedidos"],
  [/^([\d,]+) of ([\d,]+) orders shown$/, (m) => m[1] + " de " + m[2] + " pedidos mostrados"],
  [/^Refund\/cancel the (.*) label for (.*)\?$/, (m) => "¿Reembolsar/cancelar la etiqueta de " + m[1] + " para " + m[2] + "?"],
  [/^Delete this order for (.*)\? This can't be undone\.$/, (m) => "¿Eliminar este pedido de " + m[1] + "? Esto no se puede deshacer."],

  // Create label
  [/^Buy (.+) for \$([\d.,]+) and void the old label\?(?: \(old label \$([\d.,]+) gets voided\))?$/, (m) =>
    "¿Comprar " + m[1] + " por $" + m[2] + " y anular la etiqueta anterior?" + (m[3] ? " (se anula la etiqueta anterior de $" + m[3] + ")" : "")],
  [/^Buy (.+)$/, (m) => "Comprar " + m[1]],
  [/^Over ([\d.]+) oz — this won't get the letter rate\. USPS prices it as a large envelope, or switch to your box\.$/, (m) =>
    "Más de " + m[1] + " oz: no alcanza la tarifa de carta. USPS lo cobra como sobre grande, o cambia a tu caja."],
  [/^Letter rate covers up to ([\d.]+) oz and ¼″ thick\. Letters don't include tracking\. Envelopes ship through EasyPost\.$/, (m) =>
    "La tarifa de carta cubre hasta " + m[1] + " oz y ¼″ de grueso. Las cartas no incluyen rastreo. Los sobres se envían por EasyPost."],

  // Customers
  [/^([\d,]+) customers? in your directory$/, (m) => m[1] + " " + noun(m[1], "customer") + " en tu directorio"],
  [/^([\d,]+) possible duplicate groups?$/, (m) => m[1] + (m[1] === "1" ? " grupo" : " grupos") + " de posibles duplicados"],
  [/^Couldn't read that file: (.*)$/, (m) => "No se pudo leer ese archivo: " + m[1]],
  [/^Imported ([\d,]+) customers(?: \(([\d,]+) rows skipped — no name\))?\.$/, (m) =>
    "Se importaron " + m[1] + " clientes" + (m[2] ? " (" + m[2] + " filas omitidas: sin nombre)" : "") + "."],
  [/^Jump to (.+)$/, (m) => "Ir a " + m[1]],
  [/^Merge ([\d,]+) into selected$/, (m) => "Combinar " + m[1] + " en el seleccionado"],
  [/^Merged ([\d,]+) duplicates?\. Orders moved to the main customer; duplicates archived\.$/, (m) =>
    "Se " + (m[1] === "1" ? "combinó " : "combinaron ") + m[1] + " " + noun(m[1], "duplicate") + ". Los pedidos pasaron al cliente principal; los duplicados se archivaron."],
  [/^Delete (.+)\? This can't be undone\. Their past orders are kept, but they'll no longer match a customer record\.$/, (m) =>
    "¿Eliminar a " + (m[1] === "this customer" ? "este cliente" : m[1]) + "? Esto no se puede deshacer. Sus pedidos anteriores se conservan, pero ya no estarán ligados a un cliente."],
  [/^No customers match “(.+)”$/, (m) => "Ningún cliente coincide con “" + m[1] + "”"],

  // Packing slips
  [/^Made ([\d,]+) packing slips? \((4×6|letter)\)\.$/, (m) =>
    "Se " + (m[1] === "1" ? "hizo " : "hicieron ") + m[1] + (m[1] === "1" ? " nota" : " notas") + " de empaque (" + (m[2] === "letter" ? "carta" : m[2]) + ")."],
  [/^Make PDF · ([\d,]+) (slips?)$/, (m) => "Hacer PDF · " + m[1] + " " + noun(m[1], m[2])],
  [/^Make PDF · ([\d,]+)$/, (m) => "Hacer PDF · " + m[1]],
  [/^Select (.+)$/, (m) => "Seleccionar a " + m[1]],

  // Recap
  [/^([\d.]+)% shipped with (.+)$/, (m) => m[1] + "% se envió con " + m[2]],
  [/^([\d,]+) new customers? this month$/, (m) => m[1] + (m[1] === "1" ? " cliente nuevo" : " clientes nuevos") + " este mes"],
  [/^Packages went to ([\d,]+) states?$/, (m) => "Los paquetes fueron a " + m[1] + " " + noun(m[1], "state")],
  [/^Average delivery ([\d.]+) days(?:, ([\d.]+) (faster|slower) than (\w+))?$/, (m) =>
    "Entrega promedio de " + m[1] + " días" + (m[2] ? ", " + m[2] + (m[3] === "faster" ? " más rápido que " : " más lento que ") + spanishDates(m[4]) : "")],
  [/^Postage per package went (down|up) (.+)$/, (m) => "El envío por paquete " + (m[1] === "down" ? "bajó " : "subió ") + m[2]],
  [/^([+-]?[\d.]+)% vs (\w+)$/, (m) => m[1] + "% vs " + spanishDates(m[2])],
  [/^([\d.]+)% of packages$/, (m) => m[1] + "% de los paquetes"],
  [/^([\d.]+)% in 3 days or less$/, (m) => m[1] + "% en 3 días o menos"],

  // Carrier performance
  [/^(.+) saves about ([\d.]+) days? but costs (\$[\d.,]+) more per package than (.+)\.$/, (m) =>
    m[1] + " ahorra unos " + m[2] + " días pero cuesta " + m[3] + " más por paquete que " + m[4] + "."],
  [/^(.+) is both the cheapest and the fastest lately\. Easy choice\.$/, (m) => m[1] + " es la más barata y la más rápida últimamente. Fácil decisión."],
  [/^Checked ([\d,]+) packages?: ([\d,]+) newly delivered(?:, ([\d,]+) couldn't be looked up)?\.$/, (m) =>
    "Se " + (m[1] === "1" ? "revisó " : "revisaron ") + m[1] + " " + noun(m[1], "package") + ": " + m[2] + " recién entregados" +
    (m[3] ? ", " + m[3] + " no se pudieron consultar" : "") + "."],
  [/^Updating ([\d,]+)\/([\d,]+)…$/, (m) => "Actualizando " + m[1] + "/" + m[2] + "…"],

  // Returns
  [/^([\d,]+) days, not mailed yet$/, (m) => m[1] + " días, aún no lo envía"],
  [/^Sent ([\d,]+) days? ago$/, (m) => "Enviada hace " + m[1] + " " + noun(m[1], "day")],
  [/^Asked (.+)$/, (m) => "Solicitada " + spanishDates(m[1])],
  [/^Label over ([\d,]+) days old$/, (m) => "Etiqueta de hace más de " + m[1] + " días"],
  [/^(.+) return label created — (.+)$/, (m) => "Etiqueta de devolución " + m[1] + " creada — " + m[2]],
  [/^Return from (.+) marked done\.$/, (m) => "Devolución de " + (m[1] === "customer" ? "cliente" : m[1]) + " marcada como terminada."],
  [/^Return from (.+) marked received \((.+)\)\.$/, (m) =>
    "Devolución de " + (m[1] === "customer" ? "cliente" : m[1]) + " marcada como recibida (" + s(m[2]) + ")."],
  [/^Couldn't copy the (.+)\.$/, (m) => "No se pudo copiar: " + s(m[1]).toLowerCase() + "."],
  [/^(.+) copied\.$/, (m) => s(m[1]) + " copiado."],

  // Scan & Send
  [/^([\d,]+) sent this session$/, (m) => m[1] + (m[1] === "1" ? " enviado" : " enviados") + " en esta sesión"],
  [/^Sent to (.+)$/, (m) => "Enviado a " + (m[1] === "customer" ? "cliente" : m[1])],
  [/^Send to (.+)$/, (m) => "Enviar a " + m[1]],
  [/^In (.+), open (.+)'s chat\.$/, (m) => "En " + m[1] + ", abre el chat de " + m[2] + "."],
  [/^In (.+), open the customer's chat\.$/, (m) => "En " + m[1] + ", abre el chat del cliente."],

  // Scan a label
  [/^Void the (.*) label for (.+) and ask for a refund\?(?:\n\nThis package was already packed( and the customer was told it's on the way)?\.)?$/, (m) =>
    "¿Anular la etiqueta " + (m[1] ? m[1] + " " : "") + "de " + (m[2] === "this customer" ? "este cliente" : m[2]) + " y pedir el reembolso?" +
    (m[0].indexOf("already packed") >= 0 ? "\n\nEste paquete ya estaba empacado" + (m[3] ? " y ya se le avisó al cliente que va en camino" : "") + "." : "")],
  [/^Label voided\. Refund requested from the carrier \((.+)\)\.$/, (m) => "Etiqueta anulada. Se pidió el reembolso a la paquetería (" + s(m[1]) + ")."],
  [/^New label bought: (.+?) · (\S+)\. Tap Reprint label to print it\. (.*)$/, (m) =>
    "Etiqueta nueva comprada: " + m[1] + " · " + m[2] + ". Toca Reimprimir etiqueta para imprimirla. " + labelAfter(m[3])],
  [/^(Came back|Packed|Printed|Logged) (.+)$/, (m) =>
    ({ "Came back": "Regresó", Packed: "Empacado", Printed: "Impresa", Logged: "Registrado" } as Record<string, string>)[m[1]] + " " + spanishDates(m[2])],
  [/^Voided$/, () => "Anulada"],
  [/^Couldn't make the PDF: (.*)$/, (m) => "No se pudo hacer el PDF: " + s(m[1])],
  [/^· insured \$(.+)$/, (m) => "· asegurado por $" + m[1]],
  [/^refund:?$/, () => "reembolso"],
  [/^refund (.+)$/, (m) => "reembolso " + s(m[1])],

  // Ship day card
  [/^(.+) · ([\d-]+)° high · (?:([\d]+)% chance of rain|no rain)$/, (m) =>
    s(m[1]) + " · máx. " + m[2] + "° · " + (m[3] ? m[3] + "% de probabilidad de lluvia" : "sin lluvia")],
  [/^Rain in (.+, [A-Z]{2}) (.+)$/, (m) => "Lluvia en " + m[1] + " " + spanishDates(m[2]).replace(" & ", " y ")],
  [/^Heat in (.+)$/, (m) => "Calor en " + m[1]],
  [/^Freezing in (.+)$/, (m) => "Helada en " + m[1]],
  [/^(.+)’s package is headed there\. (.+)$/, (m) => "El paquete de " + m[1] + " va para allá. " + s(m[2])],
  [/^([\d,]+) packages are headed there\. (.+)$/, (m) => m[1] + " paquetes van para allá. " + s(m[2])],
];

function labelAfter(rest: string): string {
  return rest
    .replace(/^The old label couldn't be voided automatically \((.+?)\)\. Void it from the carrier's site\./, "La etiqueta anterior no se pudo anular sola ($1). Anúlala en el sitio de la paquetería.")
    .replace(/^Old label voided \(refund (.+?)\)\./, (_, r: string) => "Etiqueta anterior anulada (reembolso " + s(r) + ").")
    .replace(/ The customer already got the old tracking link, so send them the new one\.$/, " El cliente ya recibió el enlace de rastreo anterior, así que mándale el nuevo.");
}

/* ------------------------------------------------------------------ */
/* The translator                                                      */
/* ------------------------------------------------------------------ */

const cache = new Map<string, string | null>();

/** Spanish for one piece of text (already trimmed), or null to leave it in English. */
function translateCore(text: string): string | null {
  if (Object.prototype.hasOwnProperty.call(ES, text)) return ES[text];
  if (!/[A-Za-z]/.test(text)) return null;

  for (const [re, fn] of RULES) {
    const m = text.match(re);
    if (m) return fn(m);
  }

  if (isDateOnly(text)) {
    const d = spanishDates(text);
    return d.charAt(0).toUpperCase() + d.slice(1);
  }

  // "Labor Day · Monday, Sep 7", "Voided · refunded", "Boston, MA · 3 orders"
  if (text.indexOf(" · ") > 0) {
    const parts = text.split(" · ");
    let changed = false;
    const out = parts.map((p) => {
      const t = translateCore(p);
      if (t === null) return p;
      changed = true;
      return t;
    });
    if (changed) return out.join(" · ");
  }

  // Messages made of several sentences
  if (/[.?!]\s+\S/.test(text) || text.indexOf("\n") >= 0) {
    const pieces = text.split(/(\n+|(?:[.?!])\s+)/);
    // Re-attach punctuation to the sentence before it
    const sentences: string[] = [];
    for (let i = 0; i < pieces.length; i += 2) {
      const sep = pieces[i + 1] || "";
      const punct = sep.trim();
      sentences.push(pieces[i] + punct + (sep.length > punct.length ? sep.slice(punct.length) : ""));
    }
    let changed = false;
    const out = sentences.map((sen) => {
      const m = sen.match(/^(\s*)([\s\S]*?)(\s*)$/);
      if (!m || !m[2]) return sen;
      const t = translateCore(m[2]);
      if (t === null) return sen;
      changed = true;
      return m[1] + t + m[3];
    });
    if (changed) return out.join("");
  }
  return null;
}

/** Spanish for a piece of on-screen text, keeping its spaces. Returns null to leave it alone. */
export function toSpanish(raw: string): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!m || !m[2]) return null;
  const core = m[2].indexOf("\n") >= 0 && !/\n\n/.test(m[2]) ? m[2].replace(/\s+/g, " ") : m[2].replace(/[ \t]+/g, " ");
  let out: string | null;
  if (cache.has(core)) {
    out = cache.get(core) as string | null;
  } else {
    out = translateCore(core);
    if (cache.size > 5000) cache.clear();
    cache.set(core, out);
  }
  if (out === null) return null;
  return m[1] + out + m[3];
}
