import type { Config } from "tailwindcss";

/** Brand tokens taken from the AeroSphere LCA logos (navy wordmark, green→blue A, gold orbit). */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#070d2e",
          900: "#0b1660",
          800: "#16246f",
          700: "#2a3a85",
          600: "#46589f",
          500: "#6a7ab6",
        },
        sand: {
          50: "#f7f5ef",
          100: "#efebdf",
          200: "#e3dccb",
          300: "#cfc6ae",
        },
        brand: {
          green: "#4c9a3f",
          teal: "#1f8a8a",
          blue: "#1c6aa2",
          gold: "#c9a24b",
          golddark: "#9a7229",
        },
        status: {
          ok: "#2e7d4f",
          warn: "#a86b12",
          danger: "#b42318",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #4c9a3f 0%, #1f8a8a 50%, #1c6aa2 100%)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,22,96,0.04), 0 1px 1px rgba(11,22,96,0.03)",
      },
    },
  },
  plugins: [],
};

export default config;
