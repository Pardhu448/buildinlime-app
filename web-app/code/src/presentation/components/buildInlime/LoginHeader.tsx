import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import imgBrickPattern from "../../assets/brick-logo-brown.png";

export function LoginHeader() {
  return (
    <header className="w-full bg-white py-[24px] border-b border-border">
      <div className="max-w-[1440px] mx-auto px-6 flex items-center gap-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-[12px]">
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

        {/* Spacer to push Back to Home to the right */}
        <div className="flex-1" />

        {/* Back to Home Link */}
        <Link
          to="/"
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-[15px] h-[15px]" strokeWidth={1.25} />
          <span
            className="font-['Instrument_Sans',sans-serif] text-[16px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Back to home
          </span>
        </Link>
      </div>
    </header>
  );
}
