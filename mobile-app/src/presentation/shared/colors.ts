import tokens from "./design-tokens"

/**
 * BuildInLime design tokens as raw hex values, for StyleSheet call sites and for
 * imperative APIs (tabBarActiveTintColor, StatusBar) that cannot take a class name.
 *
 * This is how the app usually styles: 24 files use StyleSheet with these tokens,
 * 3 use NativeWind classes. Both are fed from the same design-tokens.js, so a
 * colour added there is available as `colors.x` here and as `bg-x` in a class —
 * add it there, not here.
 *
 * (An earlier version of this comment said to prefer NativeWind classes for all
 * component styling. The codebase never went that way — every screen added since
 * has used StyleSheet — so the advice is removed rather than left to mislead.)
 */
export const colors = tokens
