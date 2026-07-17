export function LoginTerms() {
  return (
    <p
      className="text-center mt-5 font-['Instrument_Sans',sans-serif] text-[12px] text-muted-foreground leading-[16px]"
      style={{ fontVariationSettings: "'wdth' 100" }}
    >
      By signing in you agree to our{" "}
      <a href="#" className="underline hover:text-primary">
        Terms of Service
      </a>{" "}
      &{" "}
      <a href="#" className="underline hover:text-primary">
        Privacy Policy
      </a>
      .
    </p>
  );
}
