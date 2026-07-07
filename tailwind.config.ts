import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cream: "#f6f4f1",
        taupe: "#957f67",
        sand: "#cfbda9",
        ink: "#3f362d",
        espresso: "#26211b",
      },
      fontFamily: {
        heading: ["var(--font-laluxes)", "Georgia", "serif"],
        body: ["var(--font-recoleta)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        soft: "0 2px 16px rgba(149,127,103,0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
