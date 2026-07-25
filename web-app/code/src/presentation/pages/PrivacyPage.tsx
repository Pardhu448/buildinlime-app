import { Header, HeaderLoggedIn, Footer, PageHeading, ProseSection } from "../components/buildInlime";
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_EFFECTIVE_DATE } from "../content/privacy";
import { signOutAndDispose, useRequireAuth } from "../../infrastructure/auth/client";

export default function PrivacyPage() {
  const { user } = useRequireAuth();
  const loggedIn = !!user;

  const handleSignOut = async () => {
    await signOutAndDispose();
    window.location.href = "/";
  };

  return (
    <div className="bg-white flex flex-col items-start min-h-screen">
      {loggedIn ? <HeaderLoggedIn onSignOut={handleSignOut} /> : <Header />}

      <PageHeading title="Privacy Policy" description={PRIVACY_INTRO} />

      <section className="w-full px-[120px] pt-[8px]">
        <div className="max-w-[788px] mx-auto">
          <p
            className="font-['Instrument_Sans',sans-serif] text-[14px] leading-[20px] text-muted-foreground"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Effective date: {PRIVACY_EFFECTIVE_DATE}
          </p>
        </div>
      </section>

      {PRIVACY_SECTIONS.map((section) => (
        <ProseSection key={section.title} section={section} />
      ))}

      <Footer compact />
    </div>
  );
}
