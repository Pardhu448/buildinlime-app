const tokens = require("./src/presentation/shared/design-tokens")

/**
 * Colours come from design-tokens.js — the same file colors.ts reads. This block
 * only reshapes them into the nesting Tailwind needs to build class names
 * (primary.DEFAULT → bg-primary, card.surface → bg-card-surface). Do not paste a
 * hex in here; the two sources drifted the last time they were maintained apart.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: tokens.background,
        foreground: tokens.foreground,
        primary: {
          DEFAULT: tokens.primary,
          foreground: tokens.primaryForeground,
        },
        secondary: {
          DEFAULT: tokens.secondary,
        },
        muted: {
          DEFAULT: tokens.muted,
          foreground: tokens.mutedForeground,
        },
        border: tokens.border,
        card: {
          DEFAULT: tokens.card,
          surface: tokens.cardSurface,
          border: tokens.cardBorder,
        },
        "icon-chip": tokens.iconChip,
        destructive: {
          DEFAULT: tokens.destructive,
        },
      },
      borderRadius: {
        DEFAULT: "0.625rem",
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.625rem",
        xl: "0.875rem",
      },
      fontFamily: {
        sans: ["InstrumentSans_400Regular", "system-ui"],
        "sans-medium": ["InstrumentSans_500Medium", "system-ui"],
        "sans-semibold": ["InstrumentSans_600SemiBold", "system-ui"],
        "sans-bold": ["InstrumentSans_700Bold", "system-ui"],
      },
    },
  },
  plugins: [],
}
