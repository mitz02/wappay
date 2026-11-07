import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effef4",
          100: "#d9fee7",
          200: "#b5fdd1",
          300: "#7dfab0",
          400: "#3ded8a",
          500: "#10dc6b",
          600: "#05bd57",
          700: "#089748",
          800: "#0c783d",
          900: "#0d6234",
          950: "#00381b",
        },
        whatsapp: {
          light: "#dcf8c6",
          DEFAULT: "#25d366",
          dark: "#128c7e",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 8s ease-in-out infinite",
        "fade-up": "fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        marquee: "marquee 40s linear infinite",
        "pulse-soft": "pulseSoft 2.5s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      boxShadow: {
        phone: "0 40px 80px -20px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.04)",
        card: "0 1px 2px rgba(16,24,40,0.05)",
        "card-hover": "0 12px 32px -8px rgba(16,24,40,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
