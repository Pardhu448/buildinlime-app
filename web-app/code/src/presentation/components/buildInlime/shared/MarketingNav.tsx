import { Link } from "@tanstack/react-router";
import { HEADER_LINK_CLASS, HEADER_LINK_STYLE } from "./HeaderShell";

/**
 * The marketing nav, byte-identical in Header and HeaderLoggedIn before this.
 *
 * Every item links to a real page. Exported because MobileMenu renders the same
 * destinations below the `lg:` breakpoint, and a second hand-written copy of
 * this list is exactly how the two would drift apart.
 */
export const MARKETING_NAV_ITEMS = [
  { label: "About", to: "/about" },
  { label: "Resources", to: "/resources" },
  { label: "Get Started", to: "/get-started" },
  { label: "Pricing", to: "/pricing" },
] as const;

/**
 * Hidden below `lg:`: four links plus the auth CTAs stop fitting beside the logo
 * well before the breakpoint, and MobileMenu takes over there.
 */
export function MarketingNav() {
  return (
    <nav className="hidden lg:flex items-center gap-8 ml-auto">
      {MARKETING_NAV_ITEMS.map(({ label, to }) => (
        <Link key={label} to={to} className={HEADER_LINK_CLASS} style={HEADER_LINK_STYLE}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
