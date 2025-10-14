import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "../../packages/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        base: "var(--color-base)",
        surface: "var(--color-surface)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        error: "var(--color-error)",
        text: {
          primary: "var(--color-text-primary)",
          muted: "var(--color-text-muted)"
        }
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        pill: "var(--radius-pill)"
      },
      boxShadow: {
        z1: "var(--shadow-z1)",
        z2: "var(--shadow-z2)",
        z3: "var(--shadow-z3)"
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-accent": "var(--gradient-accent)",
        "gradient-info": "var(--gradient-info)"
      },
      animation: {
        sheen: "sheen 1.2s linear infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out"
      },
      keyframes: {
        sheen: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" }
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", ...fontFamily.sans],
        serif: ["var(--font-source-serif)", "Source Serif Pro", ...fontFamily.serif]
      },
      fontSize: {
        xs: ["12px", "1.35"],
        sm: ["14px", "1.4"],
        base: ["16px", "1.5"],
        lg: ["18px", "1.45"],
        xl: ["20px", "1.4"],
        "2xl": ["24px", "1.35"],
        "3xl": ["30px", "1.3"],
        "4xl": ["36px", "1.25"]
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;
