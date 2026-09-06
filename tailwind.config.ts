import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FFFFFF",
        ink: "#222222",
        muted: "#777777",
        line: "#EEEEEE",
        surface: "#FFFFFF",
        rose: {
          50: "#FFF7F9",
          100: "#FFF1F4",
          200: "#FFE4EB",
          300: "#F7C1CD",
          400: "#F3A6B8",
          500: "#E98EA3",
          600: "#D97991",
          700: "#C9657D",
        },
        moss: {
          500: "#4E9B78",
          600: "#408564",
        },
        rust: {
          500: "#C75B5B",
          600: "#B34D4D",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(34, 34, 34, 0.04)",
        "card-hover": "0 4px 14px rgba(34, 34, 34, 0.06)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(3px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.6" },
          "100%": { transform: "scale(1.5)", opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "pulse-ring": "pulse-ring 1.6s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
