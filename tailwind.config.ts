import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    // Screen sizes. sm and md start a little lower than Tailwind's defaults
    // (640 / 768) so the iPhone Duo's inner screen (~626 wide) gets two-column
    // layouts and the iPad mini held upright (~744-756 wide) gets the tablet
    // layout. No phone is that wide held upright, and phones turned sideways
    // were already past both, so regular phones look the same.
    // "rail" = tablet-size screens (iPad mini upright, iPhone Duo open and
    // sideways): a slim icon sidebar instead of the menu button. The height
    // check keeps phones turned sideways out of it.
    screens: {
      sm: "600px",
      md: "740px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
      rail: { raw: "(min-width: 740px) and (max-width: 1023.98px) and (min-height: 560px)" },
    },
    extend: {
      colors: {
        cream: "rgb(var(--c-cream) / <alpha-value>)",
        taupe: "rgb(var(--c-taupe) / <alpha-value>)",
        sand: "rgb(var(--c-sand) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        white: "rgb(var(--c-surface) / <alpha-value>)",
      },
      fontFamily: {
        // Headings: Charman Serif. Everything else: Ltt Recoleta.
        heading: ["var(--font-heading)", "Georgia", "serif"],
        display: ["var(--font-heading)", "Georgia", "serif"],
        body: ["var(--font-body)", "Georgia", "serif"],
        sans: ["var(--font-body)", "Georgia", "serif"],
        serif: ["var(--font-body)", "Georgia", "serif"],
        mono: ["var(--font-body)", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 2px 16px rgba(90, 74, 58, 0.14)",
      },
    },
  },
  plugins: [],
};
export default config;
