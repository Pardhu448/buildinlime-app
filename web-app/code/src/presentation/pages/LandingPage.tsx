import { Header, Hero, FeaturesCarousel, Footer } from "../components/buildInlime";
import { HeaderLoggedIn } from "../components/buildInlime";
import { signOutAndDispose, useRequireAuth } from "../../infrastructure/auth/client";

export default function LandingPage() {
  const { user } = useRequireAuth();
  const loggedIn = !!user;
  const notLoggedIn = !user;

  const handleSignOut = async () => {
    await signOutAndDispose();
    window.location.href = "/";
  };

  return (
    <div className="bg-white flex flex-col items-start min-h-screen">
      {loggedIn && <HeaderLoggedIn onSignOut={handleSignOut} />}
      {notLoggedIn && <Header />}
      <Hero />
      <FeaturesCarousel />
      <Footer />
    </div>
  );
}
