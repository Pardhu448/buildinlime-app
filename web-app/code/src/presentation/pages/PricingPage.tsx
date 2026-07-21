import { Link } from "@tanstack/react-router";
import { Header, HeaderLoggedIn, Footer, PageHeading } from "../components/buildInlime";
import { signOutAndDispose, useRequireAuth } from "../../infrastructure/auth/client";

export default function PricingPage() {
  const { user } = useRequireAuth();
  const loggedIn = !!user;

  const handleSignOut = async () => {
    await signOutAndDispose();
    window.location.href = "/";
  };

  return (
    // Same fixed-viewport shell as the other marketing pages: header and
    // heading pinned, the middle scrolls, footer pinned.
    <div className="bg-white flex flex-col h-screen overflow-hidden">
      <div className="shrink-0">
        {loggedIn ? <HeaderLoggedIn onSignOut={handleSignOut} /> : <Header />}

        <PageHeading
          title="Pricing"
          description="We are still working out what the plans should look like"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <section className="px-[120px] py-[64px]">
          <div className="max-w-[640px] mx-auto flex flex-col items-center gap-[16px] bg-icon-chip border border-card-border rounded-lg px-[40px] py-[48px]">
            <p
              className="font-['Instrument_Sans',sans-serif] font-medium text-[14px] leading-[20px] text-primary uppercase tracking-[0.08em]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Coming Soon
            </p>

            <h2 className="font-['Inria_Sans',sans-serif] font-bold text-[26px] leading-[36px] text-foreground text-center">
              Plans are not ready yet
            </h2>

            <p
              className="font-['Instrument_Sans',sans-serif] text-[16px] leading-[26px] text-muted-foreground text-center"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              BuildInLime is free to use while we are building it out with the
              people on site. When there is something to charge for, we will
              publish it here first — no surprise bills on an account you
              already set up.
            </p>

            <Link
              to="/get-started"
              className="mt-[8px] inline-flex items-center rounded-md bg-primary px-[20px] py-[10px] font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-primary-foreground hover:opacity-90 transition-opacity"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Get started for free
            </Link>
          </div>
        </section>
      </div>

      <div className="shrink-0">
        <Footer compact />
      </div>
    </div>
  );
}
