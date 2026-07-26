import { LoginHeader, LoginDecorativeImage , LoginForm , LoginTerms, Footer  } from "../components/buildInlime";
import { DesktopRecommendedNoticeGate } from "../components/buildInlime/shared/DesktopRecommendedNotice";

export default function LoginPage2() {
  return (
    <div className="bg-white flex flex-col min-h-screen">
      {/* Gated on viewport width and a session flag — see the component. Mounted
          here rather than on the Login button because /login is reached several
          ways that never touch it (the hero CTA via the _authenticated redirect,
          session expiry, bookmarks). */}
      <DesktopRecommendedNoticeGate />

      <LoginHeader />

      <div className="flex-1 flex bg-white">
        <div className="max-w-[1440px] mx-auto w-full px-6 flex items-start gap-12 pt-[32px] lg:pt-[63px]">
          <LoginDecorativeImage />

          <div className="flex-1 flex justify-center">
            {/* 448px is the form's design width, not a minimum — below it the
                column just takes what the viewport gives. */}
            <div className="w-full max-w-[448px]">
              <LoginForm />
              <LoginTerms />
            </div>
          </div>
        </div>
      </div>

      <Footer compact />
    </div>
  );
}
