import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0f1b33",
          900: "#132140",
          800: "#1c2f52",
          700: "#26406b",
        },
        sand: {
          50: "#f7f5ef",
          100: "#efeadd",
          200: "#e7e0cf",
        },
        accent: {
          gold: "#c9a24b",
          green: "#3f7a5b",
          red: "#c0392b",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
