import { Link } from "@tanstack/react-router";
import {
  HeaderShell,
  HEADER_LINK_CLASS,
  HEADER_LINK_STYLE,
} from "./shared/HeaderShell";
import { MarketingNav } from "./shared/MarketingNav";
import { MarketingMobileMenu } from "./shared/MobileMenu";

export function Header() {
  return (
    <HeaderShell>
      <MarketingNav />

      {/* CTA Buttons — the desktop pair. Hidden below `lg:`, where the same two
          actions live inside the mobile menu (and route through the
          desktop-recommended notice on the way to /login). */}
      <div className="hidden lg:flex items-center gap-[16px]">
        {/* /login's validateSearch returns both fields, so Link requires both —
            it defaults them at runtime, and the validated URL carries them
            either way, so stating them here changes nothing but the types. */}
        <Link
          to="/login"
          search={{ returnTo: "/", mode: "login" }}
          className={HEADER_LINK_CLASS}
          style={HEADER_LINK_STYLE}
        >
          Login
        </Link>
        <Link
          to="/login"
          search={{ returnTo: "/", mode: "signup" }}
          className="bg-primary hover:bg-primary-hover text-white px-[24px] py-[12px] rounded-[10px] font-['Instrument_Sans',sans-serif] font-medium text-[16px] transition-colors"
          style={HEADER_LINK_STYLE}
        >
          Sign up
        </Link>
      </div>

      <MarketingMobileMenu />
    </HeaderShell>
  );
}

export default Header;
