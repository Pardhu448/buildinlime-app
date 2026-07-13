/**
 * BuildInLime design tokens as raw hex values.
 * Use these for imperative APIs (tabBarActiveTintColor, StatusBar, etc.)
 * that cannot accept Tailwind class names.
 *
 * For all component styling, prefer NativeWind classes (bg-primary, text-foreground, etc.)
 */
export const colors = {
  primary: "#976623",
  primaryForeground: "#ffffff",
  secondary: "#ac7f5e",
  secondaryForeground: "#1e1e1e",
  background: "#ffffff",
  foreground: "#1e1e1e",
  muted: "#f5f5f5",
  mutedForeground: "#717182",
  border: "#ac7f5e",
  card: "#ffffff",
  cardForeground: "#1e1e1e",
  // Card surfaces, matching the web cards (ChannelCard / BuildUnitCard).
  cardSurface: "#fdf8f2",
  cardBorder: "#e5d4c1",
  cardSurfaceHover: "#f0e5d8",
  iconChip: "#f0e5d8",
  destructive: "#d4183d",
  destructiveForeground: "#ffffff",
} as const
