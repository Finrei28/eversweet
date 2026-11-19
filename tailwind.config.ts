import { type Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";
import type { PluginAPI } from "tailwindcss/types/config";

// Direction D's colours, radii and shadows, shared byte-for-byte with the customer app
// (npm run verify:tokens). Hex values, so opacity modifiers (`bg-primary/40`) work as
// Tailwind parses them itself. src/styles/themeTokens.test.ts holds every one in place.
import tokens from "./src/styles/designTokens.json";

const { colors: c, radius, shadow } = tokens;

export default {
  darkMode: ["class"],
  content: ["./src/**/*.tsx"],
  theme: {
    extend: {
      keyframes: {
        fadeInZoomIn: {
          "0%": {
            opacity: "0",
            transform: "scale(0.2)", // Start small
          },
          "100%": {
            opacity: "1",
            transform: "scale(1)", // End at normal size
          },
        },
      },
      animation: {
        "fade-in-zoom-in": "fadeInZoomIn 0.5s ease-out forwards",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", ...fontFamily.sans],
        // Latin-only face, so the CJK fallbacks carry the Chinese headings.
        display: [
          "var(--font-display)",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          ...fontFamily.sans,
        ],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // The redesign's radii, by role. The stock sizes above stay as they were,
        // for admin and the customer pages not yet redesigned.
        seal: `${radius.seal}px`,
        card: `${radius.card}px`,
        sheet: `${radius.sheet}px`,
      },
      boxShadow: {
        // The one shadow the website draws. The app's tab bar has the other.
        "cart-bar": shadow.cartBar,
      },
      colors: {
        background: c.background,
        foreground: c.foreground,
        card: { DEFAULT: c.card, foreground: c.foreground },
        popover: { DEFAULT: c.card, foreground: c.foreground },
        primary: {
          DEFAULT: c.primary,
          foreground: c.primaryForeground,
          // Website-only caramels this site added for contrast before direction D.
          // Not in the token file: they go once no customer page uses them.
          dark: "hsl(var(--primary-dark))",
          // Large display headings only — see the note in globals.css.
          display: "hsl(var(--primary-display))",
        },
        secondary: { DEFAULT: c.secondary, foreground: c.secondaryForeground },
        muted: { DEFAULT: c.muted, foreground: c.mutedForeground },
        // Red bean in direction D, where shadcn's own `accent` was a grey hover
        // surface. The primitives hover on `muted` instead.
        accent: { DEFAULT: c.accent, foreground: c.accentForeground },
        inverse: { DEFAULT: c.inverse, foreground: c.inverseForeground },
        brand: c.brand,
        scrim: c.scrim,
        destructive: {
          DEFAULT: c.destructive,
          foreground: c.card,
          soft: c.destructiveSoft,
        },
        success: { DEFAULT: c.success, soft: c.successSoft },
        warning: { DEFAULT: c.warning, soft: c.warningSoft },
        border: c.border,
        input: c.input,
        ring: c.foreground,
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    function ({ addUtilities }: PluginAPI) {
      addUtilities({
        ".scrollbar-hide": {
          "scrollbar-width": "none", // Firefox
          "-ms-overflow-style": "none", // IE 10+
        },
        ".scrollbar-hide::-webkit-scrollbar": {
          display: "none", // Safari + Chrome
        },
      });
    },
  ],
} satisfies Config;
