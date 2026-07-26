import { useEffect, useState } from "react"

/**
 * The `lg:` breakpoint, in pixels. Tailwind v4's default, restated here because
 * the desktop-recommended notice is decided in JS rather than CSS, and it must
 * flip at exactly the width the classes do. If the theme ever overrides
 * `--breakpoint-lg`, this is the other half of that change.
 */
export const LG_BREAKPOINT = 1024

/**
 * True while the viewport is narrower than `lg:`.
 *
 * Deliberately a WIDTH check and not a user-agent or touch check. What the
 * caller actually cares about is whether the desktop layout fits, and that is a
 * question about the viewport: a phone in landscape, a small window on a laptop
 * and a tablet in portrait all want the same answer, while a touchscreen laptop
 * at 1600px does not want the mobile treatment just for having a digitiser.
 *
 * Returns `false` during SSR and on the first client render, then corrects after
 * mount. That default is deliberate: it makes the DESKTOP answer the one that
 * renders when the width is not yet known, so the notice can never flash on a
 * desktop browser — the failure mode of guessing wrong is asymmetric.
 */
export function useIsBelowLg(): boolean {
  const [isBelow, setIsBelow] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${LG_BREAKPOINT - 1}px)`)
    // Set once on mount as well as on change — `change` only fires when the
    // match FLIPS, so a page loaded on a phone would otherwise never hear about
    // a state it was already in.
    setIsBelow(query.matches)

    const onChange = (event: MediaQueryListEvent) => setIsBelow(event.matches)
    query.addEventListener(`change`, onChange)
    return () => query.removeEventListener(`change`, onChange)
  }, [])

  return isBelow
}
