import { Link } from "@tanstack/react-router";
import { HEADER_LINK_CLASS, HEADER_LINK_STYLE } from "./HeaderShell";

/**
 * The marketing nav, byte-identical in Header and HeaderLoggedIn before this.
 *
 * Every item links to a real page.
 */
const ITEMS = [
  { label: "About", to: "/about" },
  { label: "Resources", to: "/resources" },
  { label: "Get Started", to: "/get-started" },
  { label: "Pricing", to: "/pricing" },
] as const;

export function MarketingNav() {
  return (
    <nav className="flex items-center gap-8 ml-auto">
      {ITEMS.map(({ label, to }) => (
        <Link key={label} to={to} className={HEADER_LINK_CLASS} style={HEADER_LINK_STYLE}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
