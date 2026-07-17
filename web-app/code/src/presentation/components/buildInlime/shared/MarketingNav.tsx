import { Link } from "@tanstack/react-router";
import { HEADER_LINK_CLASS, HEADER_LINK_STYLE } from "./HeaderShell";

/**
 * The marketing nav, byte-identical in Header and HeaderLoggedIn before this.
 *
 * Every item points at "/" — they are placeholders for pages that do not exist
 * yet, which is preserved here rather than quietly fixed.
 */
const ITEMS = ["About", "Resources", "Get Started", "Pricing"] as const;

export function MarketingNav() {
  return (
    <nav className="flex items-center gap-8 ml-auto">
      {ITEMS.map((label) => (
        <Link key={label} to="/" className={HEADER_LINK_CLASS} style={HEADER_LINK_STYLE}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
