// lib/brand.ts
// The shared logo, colors and fonts live in one place for every site:
// the Customer Portal serves them at https://my.erendirasboutique.com/brand/
// (see BRAND.md in that repo). Change the logo or a color there, not here.
// NEXT_PUBLIC_BRAND_URL can point somewhere else if that ever moves.

export const BRAND_URL = (process.env.NEXT_PUBLIC_BRAND_URL || "https://my.erendirasboutique.com/brand").replace(/\/+$/, "");
export const BRAND_LOGO = BRAND_URL + "/logo.png";
export const BRAND_CSS = BRAND_URL + "/brand.css";

// ---- Season switch (server only) -----------------------------------------
// The season picked on the Customer Portal's Branding page (brand.json).
// Labels and slips use it to pick their print logos, since those need
// special versions (black-only for the thermal printer). Falls back to
// "everyday" if the brand file can't be read, so printing never breaks.
export async function getBrandSeason(): Promise<string> {
  try {
    const res = await fetch(BRAND_URL + "/brand.json", { next: { revalidate: 120 } });
    if (!res.ok) return "everyday";
    const data = await res.json();
    return typeof data?.season === "string" ? data.season : "everyday";
  } catch {
    return "everyday";
  }
}

// Seasonal versions of the label logos live next to the originals in
// public/, named like logobw-christmas.png. Add a file with the season's
// name to give another season its own label logo.
const SEASONAL_LABEL_LOGOS: Record<string, string[]> = {
  christmas: ["logobw.png", "logo2.png"],
};

export async function seasonalLogoFile(file: string): Promise<string> {
  const season = await getBrandSeason();
  if (SEASONAL_LABEL_LOGOS[season]?.includes(file)) return file.replace(/\.png$/, "-" + season + ".png");
  return file;
}
