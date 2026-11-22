// lib/brand.ts
// The shared logo, colors and fonts live in one place for every site:
// the Customer Portal serves them at https://my.erendirasboutique.com/brand/
// (see BRAND.md in that repo). Change the logo or a color there, not here.
// NEXT_PUBLIC_BRAND_URL can point somewhere else if that ever moves.

export const BRAND_URL = (process.env.NEXT_PUBLIC_BRAND_URL || "https://my.erendirasboutique.com/brand").replace(/\/+$/, "");
export const BRAND_LOGO = BRAND_URL + "/logo.png";
export const BRAND_CSS = BRAND_URL + "/brand.css";
