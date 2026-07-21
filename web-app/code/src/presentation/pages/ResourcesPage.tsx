import { Header, HeaderLoggedIn, Footer, ResourceSection, PageHeading } from "../components/buildInlime";
import { BLOG_ARTICLES, DOCUMENTATION_ARTICLES } from "../content/articles";
import { signOutAndDispose, useRequireAuth } from "../../infrastructure/auth/client";

export default function ResourcesPage() {
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
        title="Resources"
        description="What we are learning about building natural homes, and how to get the most out of the platform"
      />

      <ResourceSection
        title="Blog"
        to="/blog"
        description="Notes from the field on natural building, and what we are changing in the product"
        articles={BLOG_ARTICLES}
      />

      <ResourceSection
        title="Documentation"
        to="/documentation"
        description="Guides and reference material for getting your project running"
        articles={DOCUMENTATION_ARTICLES}
      />

      <Footer compact />
    </div>
  );
}
