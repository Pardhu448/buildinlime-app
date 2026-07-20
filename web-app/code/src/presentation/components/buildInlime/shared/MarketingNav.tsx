import { Link } from "@tanstack/react-router";
import { HEADER_LINK_CLASS, HEADER_LINK_STYLE } from "./HeaderShell";

/**
 * The marketing nav, byte-identical in Header and HeaderLoggedIn before this.
 *
 * Items whose page exists link to it; Pricing still points at "/" as a
 * placeholder, which is preserved rather than quietly fixed.
 */
const ITEMS = [
  { label: "About", to: "/about" },
  { label: "Resources", to: "/resources" },
  { label: "Get Started", to: "/get-started" },
  { label: "Pricing", to: "/" },
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
