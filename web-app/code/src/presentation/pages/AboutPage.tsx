import { Header, HeaderLoggedIn, Footer, PageHeading, ProseSection } from "../components/buildInlime";
import { ABOUT_INTRO, ABOUT_SECTIONS } from "../content/about";
import { signOutAndDispose, useRequireAuth } from "../../infrastructure/auth/client";

export default function AboutPage() {
  const { user } = useRequireAuth();
  const loggedIn = !!user;

  const handleSignOut = async () => {
    await signOutAndDispose();
    window.location.href = "/";
  };

  return (
    <div className="bg-white flex flex-col items-start min-h-screen">
      {loggedIn ? <HeaderLoggedIn onSignOut={handleSignOut} /> : <Header />}

      <PageHeading title="About us" description={ABOUT_INTRO} />

      {ABOUT_SECTIONS.map((section) => (
        <ProseSection key={section.title} section={section} />
      ))}

      <Footer compact />
    </div>
  );
}
