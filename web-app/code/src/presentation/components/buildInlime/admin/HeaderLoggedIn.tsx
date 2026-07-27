import {
  HeaderShell,
  HEADER_LINK_CLASS,
  HEADER_LINK_STYLE,
} from "../shared/HeaderShell";
import { MarketingNav } from "../shared/MarketingNav";
import { MobileMenu } from "../shared/MobileMenu";

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
      <div className="hidden lg:flex items-center gap-[16px]">
        <button
          onClick={handleSignOut}
          className={HEADER_LINK_CLASS}
          style={HEADER_LINK_STYLE}
        >
          Sign out
        </button>
      </div>

      {/* No desktop-recommended notice here: this header only renders for
          someone already signed in, so there is no sign-in to intercept. */}
      <MobileMenu
        authSlot={(close) => (
          <button
            onClick={() => {
              close();
              handleSignOut();
            }}
            className="w-full min-h-[44px] flex items-center justify-center rounded-[10px] border border-border text-primary hover:bg-card-surface transition-colors font-['Instrument_Sans',sans-serif] font-medium text-[16px] px-[24px] py-[12px]"
            style={HEADER_LINK_STYLE}
          >
            Sign out
          </button>
        )}
      />
    </HeaderShell>
  );
}

export default HeaderLoggedIn;
