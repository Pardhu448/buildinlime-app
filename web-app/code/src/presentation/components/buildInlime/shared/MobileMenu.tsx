import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { MARKETING_NAV_ITEMS } from "./MarketingNav";

/**
 * The sub-`lg:` half of the marketing header: a hamburger that opens a
 * full-width panel with the nav destinations and the auth actions.
 *
 * A dropdown panel rather than a slide-in drawer because the header is not
 * sticky — the panel only has to cover what is directly beneath it, and a drawer
 * would need scroll-locking and focus-trapping machinery for a five-item menu.
 *
 * `authSlot` is a render prop rather than a plain node because what goes in it
 * needs to be able to CLOSE the menu: the marketing version raises a modal on
 * top of the page, and leaving the menu open behind it means the toggle is still
 * showing "Close menu" when the modal goes away.
 */
export function MobileMenu({
  authSlot,
}: {
  authSlot: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // A menu left open across a navigation would cover the page the user just
  // asked for. The links themselves close it, but this also covers back/forward
  // and any programmatic navigation.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, [open]);

  return (
    <div className="lg:hidden ml-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        // 44px square: the icon is 24px, the rest is hit area. `relative z-50`
        // is load-bearing — the backdrop below is a positioned sibling inside
        // this same stacking context, so without an explicit z-index the button
        // (z-auto, earlier in the DOM) paints UNDER it and every tap to close
        // the menu lands on the backdrop instead.
        className="relative z-50 flex items-center justify-center w-[44px] h-[44px] -mr-[10px] rounded text-foreground hover:bg-card-surface transition-colors"
      >
        {open ? (
          <X className="w-6 h-6" aria-hidden="true" />
        ) : (
          <Menu className="w-6 h-6" aria-hidden="true" />
        )}
      </button>

      {open && (
        <>
          {/* Tapping anywhere off the panel closes it. Also stops stray taps
              reaching links on the page behind the open menu. */}
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* top-full pins the panel to the bottom edge of the header, which is
              the positioned ancestor (HeaderShell is `relative`). */}
          <nav
            aria-label="Mobile menu"
            className="absolute top-full left-0 right-0 z-40 bg-white border-b border-border shadow-lg px-6 py-4 flex flex-col"
          >
            {MARKETING_NAV_ITEMS.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                onClick={() => setOpen(false)}
                className="font-['Instrument_Sans',sans-serif] text-[16px] text-black hover:text-primary transition-colors py-[12px] min-h-[44px] flex items-center border-b border-border"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                {label}
              </Link>
            ))}

            <div className="flex flex-col gap-[12px] pt-[16px]">
              {authSlot(() => setOpen(false))}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

/**
 * The logged-out marketing header's mobile menu: nav links plus Login / Sign up.
 *
 * These are plain links. The desktop-recommended notice used to be raised from
 * here by intercepting the click, which covered only this one route to /login —
 * the hero's "Start Building" CTA reaches it through the _authenticated
 * redirect, and never touched this code. The notice now fires after sign-in from
 * AuthenticatedLayout (see DesktopRecommendedNotice), so nothing on the way to
 * /login needs to raise it and this is ordinary markup again.
 */
export function MarketingMobileMenu({ returnTo = "/" }: { returnTo?: string }) {
  const actionClass =
    "w-full text-center min-h-[44px] flex items-center justify-center rounded-[10px] font-['Instrument_Sans',sans-serif] font-medium text-[16px] px-[24px] py-[12px] transition-colors";

  return (
    <MobileMenu
      authSlot={(close) => (
        <>
          <Link
            to="/login"
            search={{ returnTo, mode: "login" }}
            onClick={close}
            className={`${actionClass} border border-border text-primary hover:bg-card-surface`}
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Login
          </Link>

          <Link
            to="/login"
            search={{ returnTo, mode: "signup" }}
            onClick={close}
            className={`${actionClass} bg-primary hover:bg-primary-hover text-white`}
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Sign up
          </Link>
        </>
      )}
    />
  );
}
