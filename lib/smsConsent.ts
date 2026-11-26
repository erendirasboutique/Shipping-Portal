// lib/smsConsent.ts
// The exact words customers agree to on /sms. Shared by the page and the API,
// and saved with every sign-up so there's a record of what they agreed to.
// If you change these, also update the Telnyx campaign's opt-in description.

export const SMS_PROGRAM = "Erendira's Boutique";

export const SMS_CONSENT_ES =
  "Sí, quiero recibir mensajes de texto de Erendira's Boutique sobre mis pedidos y envíos, y anuncios de lives y ofertas. " +
  "La frecuencia de mensajes varía. Pueden aplicar tarifas de mensajes y datos. El consentimiento no es una condición de compra. " +
  "Responde STOP para cancelar y HELP para ayuda.";

export const SMS_CONSENT_EN =
  "Yes, I want to receive text messages from Erendira's Boutique about my orders and shipping, and announcements about lives and sales. " +
  "Msg frequency varies. Msg & data rates may apply. Consent is not a condition of purchase. Reply STOP to opt out, HELP for help.";

/** First text after signing up (same as the campaign's opt-in message). */
export const SMS_WELCOME =
  "Erendira's Boutique: ¡Gracias por suscribirte! Recibirás actualizaciones de tus pedidos y anuncios de lives y ofertas. " +
  "La frecuencia varía. Pueden aplicar tarifas de mensajes y datos. Responde HELP para ayuda, STOP para cancelar.";

export const SUPPORT_EMAIL = "hello@erendirasboutique.com";
