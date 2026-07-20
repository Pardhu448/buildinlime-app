import { Header, HeaderLoggedIn, Footer, ArticleList, PageHeading } from "../components/buildInlime";
import { DOCUMENTATION_ARTICLES } from "../content/articles";
import { signOutAndDispose, useRequireAuth } from "../../infrastructure/auth/client";

export default function DocumentationPage() {
  const { user } = useRequireAuth();
  const loggedIn = !!user;

  const handleSignOut = async () => {
    await signOutAndDispose();
    window.location.href = "/";
  };

  return (
    // Fixed to the viewport: header, heading and footer stay put while the
    // articles scroll in the middle.
    <div className="bg-white flex flex-col h-screen overflow-hidden">
      <div className="shrink-0">
        {loggedIn ? <HeaderLoggedIn onSignOut={handleSignOut} /> : <Header />}

        <PageHeading
          title="Documentation"
          description="Guides and reference material for getting your project running"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <ArticleList articles={DOCUMENTATION_ARTICLES} />
      </div>

      <div className="shrink-0">
        <Footer compact />
      </div>
    </div>
  );
}
