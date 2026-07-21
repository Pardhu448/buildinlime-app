import { Header, HeaderLoggedIn, Footer, PageHeading, FeatureSection } from "../components/buildInlime";
import { FEATURE_GROUPS } from "../content/features";
import { signOutAndDispose, useRequireAuth } from "../../infrastructure/auth/client";

export default function FeaturesPage() {
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
        title="Features"
        description="What the web app and the mobile app can each do today — including where they differ, and what still needs a connection"
      />

      {FEATURE_GROUPS.map((group) => (
        <FeatureSection key={group.title} group={group} />
      ))}

      <Footer compact />
    </div>
  );
}
