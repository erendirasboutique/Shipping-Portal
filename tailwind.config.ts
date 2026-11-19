import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cream: "rgb(var(--c-cream) / <alpha-value>)",
        taupe: "rgb(var(--c-taupe) / <alpha-value>)",
        sand: "rgb(var(--c-sand) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        white: "rgb(var(--c-surface) / <alpha-value>)",
      },
      fontFamily: {
        // Headings: The Silver Editorial. Everything else: Evolve Early.
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
