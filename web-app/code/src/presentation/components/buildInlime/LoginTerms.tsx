export function LoginTerms() {
  return (
    <p
      className="text-center mt-5 font-['Instrument_Sans',sans-serif] text-[12px] text-[#717182] leading-[16px]"
      style={{ fontVariationSettings: "'wdth' 100" }}
    >
      By signing in you agree to our{" "}
      <a href="#" className="underline hover:text-[#976623]">
        Terms of Service
      </a>{" "}
      &{" "}
      <a href="#" className="underline hover:text-[#976623]">
        Privacy Policy
      </a>
      .
    </p>
  );
}
