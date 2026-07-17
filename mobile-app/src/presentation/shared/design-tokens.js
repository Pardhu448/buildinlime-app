/**
 * The single source of truth for BuildInLime's mobile colour palette.
 *
 * Plain CommonJS on purpose. tailwind.config.js is loaded by Metro outside the
 * TypeScript pipeline and can only `require()`; colors.ts imports the same object
 * (expo's tsconfig.base sets allowJs + esModuleInterop). One file, both readers.
 *
 * Change a colour HERE, never in a consumer. The two consumers used to hold
 * separate hand-maintained copies and they drifted: cardSurface, cardBorder and
 * iconChip existed only on the colors.ts side, so the NativeWind side had no
 * class for them at all — and nothing failed loudly enough for anyone to notice.
 *
 * Hex rather than semantic aliases, because the tokens are consumed two ways:
 * tailwind.config.js maps them into its own nested shape (bg-card-surface), and
 * colors.ts hands them to StyleSheet and to imperative APIs like
 * tabBarActiveTintColor, which take a raw colour string.
 */
module.exports = {
  primary: "#976623",
  primaryForeground: "#ffffff",
  secondary: "#ac7f5e",
  background: "#ffffff",
  foreground: "#1e1e1e",
  muted: "#f5f5f5",
  mutedForeground: "#717182",
  border: "#ac7f5e",
  card: "#ffffff",
  // Card surfaces, matching the web cards (ChannelCard / BuildUnitCard).
  cardSurface: "#fdf8f2",
  cardBorder: "#e5d4c1",
  iconChip: "#f0e5d8",
  destructive: "#d4183d",
}
