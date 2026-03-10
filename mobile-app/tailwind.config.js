/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        foreground: "#1e1e1e",
        primary: {
          DEFAULT: "#976623",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#ac7f5e",
          foreground: "#1e1e1e",
        },
        muted: {
          DEFAULT: "#f5f5f5",
          foreground: "#717182",
        },
        border: "#ac7f5e",
        card: {
          DEFAULT: "#ffffff",
          foreground: "#1e1e1e",
        },
        destructive: {
          DEFAULT: "#d4183d",
          foreground: "#ffffff",
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
