import {
  HeaderShell,
  HEADER_LINK_CLASS,
  HEADER_LINK_STYLE,
} from "../shared/HeaderShell";
import { MarketingNav } from "../shared/MarketingNav";

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
    <HeaderShell>
      <MarketingNav />

      {/* CTA Buttons - Sign out only */}
      <div className="flex items-center gap-[16px]">
        <button
          onClick={handleSignOut}
          className={HEADER_LINK_CLASS}
          style={HEADER_LINK_STYLE}
        >
          Sign out
        </button>
      </div>
    </HeaderShell>
  );
}

export default HeaderLoggedIn;
