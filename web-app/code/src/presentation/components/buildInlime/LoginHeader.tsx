import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { HeaderShell } from "./shared/HeaderShell";

export function LoginHeader() {
  return (
    <HeaderShell>
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
    </HeaderShell>
  );
}
