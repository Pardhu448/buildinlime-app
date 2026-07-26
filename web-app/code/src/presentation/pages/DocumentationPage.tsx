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
    // Desktop pins the shell to the viewport: header, heading and footer stay
    // put while the articles scroll in the middle.
    //
    // That inverts badly on a phone. An inner scroller inside a 100vh box means
    // the document itself never scrolls, so the browser's own chrome never
    // collapses — the address bar permanently eats a chunk of an already small
    // screen — and overscroll rubber-bands the wrong element. Below lg: the page
    // is therefore an ordinary document that scrolls as a whole.
    <div className="bg-white flex flex-col min-h-screen lg:h-screen lg:overflow-hidden">
      <div className="shrink-0">
        {loggedIn ? <HeaderLoggedIn onSignOut={handleSignOut} /> : <Header />}

        <PageHeading
          title="Documentation"
          description="Guides and reference material for getting your project running"
        />
      </div>

      <div className="flex-1 min-h-0 lg:overflow-y-auto">
        <ArticleList articles={DOCUMENTATION_ARTICLES} />
      </div>

      <div className="shrink-0">
        <Footer compact />
      </div>
    </div>
  );
}
