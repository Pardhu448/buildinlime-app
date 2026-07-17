import { Link } from "@tanstack/react-router";
import imgBrickPattern from "../../assets/brick-logo-brown.png";

export function Header() {
  return (
    <header className="w-full bg-white py-[24px] border-b border-[#ac7f5e]">
      <div className="max-w-[1440px] mx-auto px-6 flex items-center gap-8">
        {/* Logo — links to the home page */}
        <Link to="/" className="flex items-center gap-[12px] hover:opacity-80 transition-opacity">
          <img
            src={imgBrickPattern}
            alt="BuildInLime"
            className="w-[54px] h-[34px] object-cover"
          />
          <span
            className="font-['Inria_Sans',sans-serif] font-bold text-[24px] text-[#1e1e1e]"
          >
            BuildInLime
          </span>
        </Link>

        {/* Navigation - aligned closer to CTA buttons */}
        <nav className="flex items-center gap-8 ml-auto">
          <Link
            to="/"
            className="font-['Instrument_Sans',sans-serif] text-[16px] text-black hover:text-[#976623] transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            About
          </Link>
          <Link
            to="/"
            className="font-['Instrument_Sans',sans-serif] text-[16px] text-black hover:text-[#976623] transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Resources
          </Link>
          <Link
            to="/"
            className="font-['Instrument_Sans',sans-serif] text-[16px] text-black hover:text-[#976623] transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Get Started
          </Link>
          <Link
            to="/"
            className="font-['Instrument_Sans',sans-serif] text-[16px] text-black hover:text-[#976623] transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Pricing
          </Link>
        </nav>

        {/* CTA Buttons */}
        <div className="flex items-center gap-[16px]">
          <Link
            to="/login"
            className="font-['Instrument_Sans',sans-serif] text-[16px] text-black hover:text-[#976623] transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Login
          </Link>
          <Link
            to="/login"
            search={{ mode: "signup" }}
            className="bg-[#976623] hover:bg-primary-hover text-white px-[24px] py-[12px] rounded-[10px] font-['Instrument_Sans',sans-serif] font-medium text-[16px] transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Header;
