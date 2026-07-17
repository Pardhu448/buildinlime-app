import { Link } from "@tanstack/react-router";
import imgBrickPattern from "../../../assets/brick-logo-brown.png";

interface HeaderLoggedInProps {
  onSignOut?: () => void;
}

export function HeaderLoggedIn({ onSignOut }: HeaderLoggedInProps) {
  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
    }
  };

  return (
    <header className="w-full bg-white py-[24px] border-b border-border">
      <div className="max-w-[1440px] mx-auto px-6 flex items-center gap-8">
        {/* Logo — links to the home page */}
        <Link to="/" className="flex items-center gap-[12px] hover:opacity-80 transition-opacity">
          <img
            src={imgBrickPattern}
            alt="BuildInLime"
            className="w-[54px] h-[34px] object-cover"
          />
          <span
            className="font-['Inria_Sans',sans-serif] font-bold text-[24px] text-foreground"
          >
            BuildInLime
          </span>
        </Link>

        {/* Navigation - aligned closer to CTA buttons */}
        <nav className="flex items-center gap-8 ml-auto">
          <Link
            to="/"
            className="font-['Instrument_Sans',sans-serif] text-[16px] text-black hover:text-primary transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            About
          </Link>
          <Link
            to="/"
            className="font-['Instrument_Sans',sans-serif] text-[16px] text-black hover:text-primary transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Resources
          </Link>
          <Link
            to="/"
            className="font-['Instrument_Sans',sans-serif] text-[16px] text-black hover:text-primary transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Get Started
          </Link>
          <Link
            to="/"
            className="font-['Instrument_Sans',sans-serif] text-[16px] text-black hover:text-primary transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Pricing
          </Link>
        </nav>

        {/* CTA Buttons - Sign out only */}
        <div className="flex items-center gap-[16px]">
          <button
            onClick={handleSignOut}
            className="font-['Instrument_Sans',sans-serif] text-[16px] text-black hover:text-primary transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

export default HeaderLoggedIn;
