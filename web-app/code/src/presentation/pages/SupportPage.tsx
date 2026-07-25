import { Header, HeaderLoggedIn, Footer, PageHeading } from "../components/buildInlime";
import { signOutAndDispose, useRequireAuth } from "../../infrastructure/auth/client";

export default function SupportPage() {
  const { user } = useRequireAuth();
  const loggedIn = !!user;

  const handleSignOut = async () => {
    await signOutAndDispose();
    window.location.href = "/";
  };

  return (
    <div className="bg-white flex flex-col items-start min-h-screen">
      {loggedIn ? <HeaderLoggedIn onSignOut={handleSignOut} /> : <Header />}

      <PageHeading
        title="Support"
        description="Need a hand with BuildInLime? We're happy to help."
      />

      <section className="w-full px-[120px] py-[20px]">
        <div className="max-w-[788px] mx-auto flex flex-col gap-[12px]">
          <h2 className="font-['Inria_Sans',sans-serif] font-bold text-[22px] leading-[31px] text-foreground">
            Contact us
          </h2>
          <p
            className="font-['Instrument_Sans',sans-serif] text-[16px] leading-[26px] text-black"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            For anything related to the application — questions, issues, feature
            requests, or account help — reach us at{" "}
            <a
              href="mailto:support@buildinlime.com"
              className="text-primary hover:underline"
            >
              support@buildinlime.com
            </a>
            . We'll get back to you as soon as we can.
          </p>
        </div>
      </section>

      <Footer compact />
    </div>
  );
}
