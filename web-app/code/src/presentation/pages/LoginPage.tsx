import { LoginHeader, LoginDecorativeImage , LoginForm , LoginTerms, Footer  } from "../components/buildInlime";

export default function LoginPage2() {
  return (
    <div className="bg-white flex flex-col min-h-screen">
      {/* The narrow-viewport notice used to be raised here. It now fires after
          sign-in, from AuthenticatedLayout: the warning is about the workspace
          layout, so it belongs where the workspace appears rather than in front
          of a form that works fine on a phone. */}

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
