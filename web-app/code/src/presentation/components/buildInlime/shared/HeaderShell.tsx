import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import imgBrickPattern from "../../../assets/brick-logo-brown.png";

/**
 * The bar and logo every page header opens with: full-width white strip, a
 * bottom border, the 1440px container, and the brick logo linking home.
 *
 * All three headers had their own copy — Header (landing), LoginHeader
 * (login/signup) and HeaderLoggedIn (in-app) — identical down to the [24px]
 * padding and the [54px]×[34px] logo. What differs is only what sits to the
 * right of the logo, which is what `children` is for.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  return (
    // `relative` makes this the positioned ancestor MobileMenu's dropdown pins
    // itself to (`top-full`), and z-50 keeps the header — and so the menu
    // toggle — above that menu's backdrop.
    <header className="relative z-50 w-full bg-white py-[16px] lg:py-[24px] border-b border-border">
      <div className="max-w-[1440px] mx-auto px-6 flex items-center gap-8">
        {/* Logo — links to the home page */}
        <Link
          to="/"
          className="flex items-center gap-[12px] hover:opacity-80 transition-opacity"
        >
          <img
            src={imgBrickPattern}
            alt="BuildInLime"
            className="w-[54px] h-[34px] object-cover"
          />
          <span className="font-['Inria_Sans',sans-serif] font-bold text-[24px] text-foreground">
            BuildInLime
          </span>
        </Link>

        {children}
      </div>
    </header>
  );
}

/**
 * The class every header link wears. Shared with the CTAs beside the nav (Login,
 * Sign out), which are a Link and a button respectively and so cannot share a
 * component — only this.
 */
export const HEADER_LINK_CLASS =
  "font-['Instrument_Sans',sans-serif] text-[16px] text-black hover:text-primary transition-colors";

/** Paired with HEADER_LINK_CLASS; the design uses the narrow width axis. */
export const HEADER_LINK_STYLE = { fontVariationSettings: "'wdth' 100" } as const;
