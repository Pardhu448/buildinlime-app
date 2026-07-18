/**
 * Read a single route param value.
 *
 * expo-router types a param as `string | string[]` because a query key can
 * repeat (`?id=1&id=2`). The dynamic segments in this app never do — but
 * `dangerouslySingular` asks for `string | undefined`, so the array case has to
 * be collapsed rather than assumed away.
 */
export const singleParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v
