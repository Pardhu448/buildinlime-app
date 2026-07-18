import { LoginHeader, LoginDecorativeImage , LoginForm , LoginTerms  } from "../components/buildInlime";

export default function LoginPage2() {
  return (
    <div className="bg-white flex flex-col min-h-screen">
      <LoginHeader />

      <div className="flex-1 flex bg-white">
        <div className="max-w-[1440px] mx-auto w-full px-6 flex items-start gap-12 pt-[63px]">
          <LoginDecorativeImage />

          <div className="flex-1 flex justify-center">
            <div className="w-[448px]">
              <LoginForm />
              <LoginTerms />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
