'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Locale = 'en' | 'es';

/**
 * Admin UI translations.
 *
 * The customer-facing portal has its own copy in PortalBaskets — that one
 * follows the customer's browser. This one follows whoever is running the
 * live, and sticks per browser.
 */
const DICT = {
  en: {
    // shell
    brand: "Erendira's Boutique",
    liveSales: 'Live sales',
    catalog: 'Catalog',
    runLive: 'Run live',
    baskets: 'Baskets',
    language: 'Español',

    // sales index
    startSale: 'Start a sale',
    newSale: 'New sale',
    createSale: 'Create sale',
    cancel: 'Cancel',
    noSalesYet: 'No sales yet',
    noSalesHint: 'Start one, then load the rack before you go live.',
    liveDate: 'Live date',
    saleName: 'Name (optional)',
    saleNamePlaceholder: 'Wednesday night rack',
    payBy: 'Pay by',
    defaultShipping: 'Default shipping',
    howToPay: 'How to pay — shown on the customer portal',
    howToPayEs: 'Cómo pagar (Spanish)',
    creating: 'Creating…',
    sale: 'Sale',
    status: 'Status',
    paid: 'Paid',
    gross: 'Gross',
    open: 'Open',

    // catalog
    loadTheRack: 'Load the rack',
    oneAtATime: 'One at a time',
    pasteAList: 'Paste a list',
    tagCode: 'Tag code',
    description: 'Description',
    descriptionEs: 'Description (Spanish)',
    price: 'Price',
    howMany: 'How many',
    photo: 'Photo',
    addItem: 'Add item',
    adding: 'Adding…',
    addAll: 'Add all',
    onTheRack: 'On the rack',
    atFullPrice: 'at full price',
    nothingLoaded: 'Nothing on the rack yet',
    nothingLoadedHint:
      'Add it now and the live becomes basket number plus tag code — nothing else to type.',
    remove: 'Remove',
    left: 'left',
    of: 'of',
    pasteHint: 'One item per line — code, description, price, how many',
    noPhoto: 'No photo',

    // claims
    claims: 'Claims',
    showRack: 'Show rack',
    hideRack: 'Hide rack',
    basket: 'Basket',
    tag: 'Tag',
    addToBasket: 'Add to basket',
    newBasket: 'New basket',
    saving: 'Saving…',
    nothingClaimed: 'Nothing claimed yet',
    nothingClaimedHint: 'Type a basket number, then a tag code. Every claim lands here with an undo.',
    claimHint: 'Basket → Enter → tag → Enter. The number sticks for a run of items.',
    undoHint: 'Ctrl+Z undoes the last claim',
    undo: 'Undo',
    running: 'running',

    // baskets
    empty: 'Empty',
    unmatched: 'Unmatched',
    awaitingPay: 'Awaiting pay',
    collected: 'Collected',
    finalizeAll: 'Finalize every matched basket',
    finalize: 'Finalize',
    markPaid: 'Mark paid',
    release: 'Release',
    reopen: 'Reopen',
    copyMessage: 'Copy message',
    copied: 'Copied',
    cardLink: 'Card link',
    customer: 'Customer',
    items: 'Items',
    shipping: 'Shipping',
    total: 'Total',
    subtotal: 'Subtotal',
    paidWith: 'Paid with',
    matchCustomer: 'Match a customer',
    searchCustomer: 'Search name, email, phone',
    unmatch: 'Unmatch',
    change: 'Change',
    noMatches: 'No one matches',
    addThemFirst: 'Add them on the customers page first.',
    searching: 'Searching…',
    howDidTheyPay: 'How did they pay?',
    reference: 'Reference (optional)',
    referencePlaceholder: 'Zelle conf #, paid at shop…',
    pickOne: 'Pick one',
    closePanel: 'Close',
    noBasketsYet: 'No baskets yet',
    noBasketsHint: 'Baskets appear the moment the first claim lands during the live.',
    basketEmpty: 'Nothing in this basket yet',
    matchFirst: 'Match a customer first',
    lockTotal: 'Lock the total so the portal can show it',
    releaseHint: 'Put the items back on the rack',
    reopenHint: 'Unlock the total. Clears the payment record.',
    portalLink: 'Portal link',
    cardLinkHint: 'Make it in the billing portal, paste it here. Leave empty to remove.',
    save: 'Save',
    jumpToBasket: 'Jump to basket',

    // photo
    dropPhoto: 'Drop a photo, click, or paste',
    uploading: 'Uploading…',
    replacePhoto: 'Replace',
    removePhoto: 'Remove',
    photoTooBig: 'That image is over 10MB. Try a smaller one.',
    photoWrongType: 'That needs to be an image file.',
    uploadFailed: 'Upload failed',
    // send
    sendToMessenger: 'Send',
    copyForMessenger: 'Copy total + photo',
    openMessenger: 'Open Messenger',
    sending: 'Opening…',
    sent: 'Sent',
    copiedBoth: 'Text and photo copied. Paste the text, then paste again for the photo.',
    copiedTextOnly: 'Text copied. The photo would not copy — save it and attach it by hand.',
    sendFailed: 'Could not open the share sheet.',
    desktopHint: 'On your phone this opens Messenger with the photo attached.',
    basketPhoto: 'Photo of their basket',
    operator: 'You are',
    operatorHint: 'Shows on baskets you touch',
    whoName: 'Your name',
    by: 'by',
    created: 'created',
    finalized: 'finalized',
    paidBy: 'marked paid',
    tracking: 'Tracking',
    trackingNumber: 'Tracking number',
    carrier: 'Carrier',
    trackingHint: 'Shows on their order page as soon as you save it',
    trackingFromLabel: 'Already pulled from the label — nothing to type. The field below is only for packages shipped outside the portal.',
    noOrderYet: 'No order yet',
  },
  es: {
    brand: "Erendira's Boutique",
    liveSales: 'Ventas en vivo',
    catalog: 'Catálogo',
    runLive: 'En vivo',
    baskets: 'Canastas',
    language: 'English',

    startSale: 'Empezar una venta',
    newSale: 'Nueva venta',
    createSale: 'Crear venta',
    cancel: 'Cancelar',
    noSalesYet: 'Todavía no hay ventas',
    noSalesHint: 'Empieza una y carga el perchero antes del live.',
    liveDate: 'Fecha del live',
    saleName: 'Nombre (opcional)',
    saleNamePlaceholder: 'Perchero del miércoles',
    payBy: 'Pagar antes de',
    defaultShipping: 'Envío predeterminado',
    howToPay: 'Cómo pagar — se muestra en el portal del cliente',
    howToPayEs: 'Cómo pagar (español)',
    creating: 'Creando…',
    sale: 'Venta',
    status: 'Estado',
    paid: 'Pagadas',
    gross: 'Total bruto',
    open: 'Abrir',

    loadTheRack: 'Cargar el perchero',
    oneAtATime: 'Uno por uno',
    pasteAList: 'Pegar una lista',
    tagCode: 'Código',
    description: 'Descripción',
    descriptionEs: 'Descripción (español)',
    price: 'Precio',
    howMany: 'Cuántos',
    photo: 'Foto',
    addItem: 'Agregar artículo',
    adding: 'Agregando…',
    addAll: 'Agregar todos',
    onTheRack: 'En el perchero',
    atFullPrice: 'a precio completo',
    nothingLoaded: 'El perchero está vacío',
    nothingLoadedHint:
      'Cárgalo ahora y el live se vuelve número de canasta más código — nada más que escribir.',
    remove: 'Quitar',
    left: 'quedan',
    of: 'de',
    pasteHint: 'Un artículo por línea — código, descripción, precio, cuántos',
    noPhoto: 'Sin foto',

    claims: 'Apartados',
    showRack: 'Ver perchero',
    hideRack: 'Ocultar perchero',
    basket: 'Canasta',
    tag: 'Código',
    addToBasket: 'Agregar a la canasta',
    newBasket: 'Nueva canasta',
    saving: 'Guardando…',
    nothingClaimed: 'Nada apartado todavía',
    nothingClaimedHint:
      'Escribe el número de canasta y luego el código. Cada apartado aparece aquí con opción de deshacer.',
    claimHint: 'Canasta → Enter → código → Enter. El número se queda para varios artículos.',
    undoHint: 'Ctrl+Z deshace el último apartado',
    undo: 'Deshacer',
    running: 'acumulado',

    empty: 'Vacía',
    unmatched: 'Sin cliente',
    awaitingPay: 'Esperando pago',
    collected: 'Cobrado',
    finalizeAll: 'Cerrar todas las canastas con cliente',
    finalize: 'Cerrar',
    markPaid: 'Marcar pagada',
    release: 'Liberar',
    reopen: 'Reabrir',
    copyMessage: 'Copiar mensaje',
    copied: 'Copiado',
    cardLink: 'Enlace de tarjeta',
    customer: 'Cliente',
    items: 'Artículos',
    shipping: 'Envío',
    total: 'Total',
    subtotal: 'Subtotal',
    paidWith: 'Pagó con',
    matchCustomer: 'Asignar cliente',
    searchCustomer: 'Buscar nombre, correo, teléfono',
    unmatch: 'Quitar cliente',
    change: 'Cambiar',
    noMatches: 'Nadie coincide con',
    addThemFirst: 'Agrégalo primero en la página de clientes.',
    searching: 'Buscando…',
    howDidTheyPay: '¿Cómo pagó?',
    reference: 'Referencia (opcional)',
    referencePlaceholder: 'Conf. de Zelle, pagó en la tienda…',
    pickOne: 'Elige uno',
    closePanel: 'Cerrar',
    noBasketsYet: 'Todavía no hay canastas',
    noBasketsHint: 'Las canastas aparecen cuando llega el primer apartado del live.',
    basketEmpty: 'Esta canasta está vacía',
    matchFirst: 'Asigna un cliente primero',
    lockTotal: 'Cierra el total para que el portal lo muestre',
    releaseHint: 'Devuelve los artículos al perchero',
    reopenHint: 'Reabre el total. Borra el registro de pago.',
    portalLink: 'Enlace del portal',
    cardLinkHint: 'Créalo en el portal de facturación y pégalo aquí. Déjalo vacío para quitarlo.',
    save: 'Guardar',
    jumpToBasket: 'Ir a la canasta',

    dropPhoto: 'Arrastra una foto, haz clic o pega',
    uploading: 'Subiendo…',
    replacePhoto: 'Cambiar',
    removePhoto: 'Quitar',
    photoTooBig: 'La imagen pesa más de 10MB. Usa una más chica.',
    photoWrongType: 'Tiene que ser un archivo de imagen.',
    uploadFailed: 'No se pudo subir',
    sendToMessenger: 'Enviar',
    copyForMessenger: 'Copiar total y foto',
    openMessenger: 'Abrir Messenger',
    sending: 'Abriendo…',
    sent: 'Enviado',
    copiedBoth: 'Texto y foto copiados. Pega el texto y luego pega otra vez la foto.',
    copiedTextOnly: 'Texto copiado. La foto no se pudo copiar — guárdala y adjúntala a mano.',
    sendFailed: 'No se pudo abrir para compartir.',
    desktopHint: 'En tu teléfono esto abre Messenger con la foto adjunta.',
    basketPhoto: 'Foto de su canasta',
    operator: 'Eres',
    operatorHint: 'Aparece en las canastas que toques',
    whoName: 'Tu nombre',
    by: 'por',
    created: 'creada',
    finalized: 'cerrada',
    paidBy: 'marcada pagada',
    tracking: 'Rastreo',
    trackingNumber: 'Número de rastreo',
    carrier: 'Paquetería',
    trackingHint: 'Aparece en su página en cuanto lo guardes',
    trackingFromLabel: 'Ya viene de la etiqueta — no hay que escribir nada. El campo de abajo es solo para paquetes enviados fuera del portal.',
    noOrderYet: 'Todavía sin orden',
  },
} as const;

/**
 * Every key from the English dictionary, each widened to `string`.
 *
 * Not `(typeof DICT)['en']` — `as const` makes that the *literal* English
 * strings, so "Ventas en vivo" isn't assignable to "Live sales" and the
 * Spanish half won't compile. Mapping to string keeps the key names
 * checked (a typo in `t.baskts` still errors) while letting either
 * language's values through.
 */
export type Dict = { readonly [K in keyof (typeof DICT)['en']]: string };

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
}>({
  locale: 'en',
  setLocale: () => {},
  t: DICT.en,
});

const STORAGE_KEY = 'eb-live-locale';

export function LocaleProvider({ children }: { children: any }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  // Read the saved choice after mount. Doing it in useState's initializer
  // would mismatch the server render and blow up hydration.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'es' || saved === 'en') setLocaleState(saved);
    } catch {
      // Private mode or storage disabled — English is a fine default.
    }
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not worth surfacing. The toggle still works for this session.
    }
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: DICT[locale] }}>
      {children}
    </LocaleContext.Provider>
  );
}

export interface LocaleValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
}

export function useLocale(): LocaleValue {
  return useContext(LocaleContext);
}
