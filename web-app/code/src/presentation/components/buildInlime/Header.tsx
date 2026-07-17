import { Link } from "@tanstack/react-router";
import {
  HeaderShell,
  HEADER_LINK_CLASS,
  HEADER_LINK_STYLE,
} from "./shared/HeaderShell";
import { MarketingNav } from "./shared/MarketingNav";

export function Header() {
  return (
    <HeaderShell>
      <MarketingNav />

      {/* CTA Buttons */}
      <div className="flex items-center gap-[16px]">
        <Link to="/login" className={HEADER_LINK_CLASS} style={HEADER_LINK_STYLE}>
          Login
        </Link>
        <Link
          to="/login"
          search={{ mode: "signup" }}
          className="bg-primary hover:bg-primary-hover text-white px-[24px] py-[12px] rounded-[10px] font-['Instrument_Sans',sans-serif] font-medium text-[16px] transition-colors"
          style={HEADER_LINK_STYLE}
        >
          Sign up
        </Link>
      </div>
    </HeaderShell>
  );
}

export default Header;
