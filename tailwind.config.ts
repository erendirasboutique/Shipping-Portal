import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    // ...everything else unchanged
  theme: {
    extend: {
      colors: {
        cream: "#f6f4f1",
        taupe: "#957f67",
        sand: "#cfbda9",
        ink: "#3f362d",
      },
      fontFamily: {
        heading: ["var(--font-laluxes)", "Georgia", "serif"],
        body: ["var(--font-recoleta)", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 2px 16px rgba(149,127,103,0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
