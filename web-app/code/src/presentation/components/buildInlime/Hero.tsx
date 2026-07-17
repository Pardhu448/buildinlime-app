import { Link } from "@tanstack/react-router";

export function Hero() {
  return (
    <section className="w-full bg-gradient-to-b from-white to-muted px-[120px] pt-[80px] pb-[80px]">
      <div className="max-w-[1270px] mx-auto flex flex-col items-center gap-[24px]">
        {/* Heading */}
        <h1 className="font-['Inria_Sans',sans-serif] font-bold text-[48px] leading-[72px] text-foreground text-center max-w-[786px]">
          Collaboration Platform to Build Natural Homes
        </h1>

        {/* Paragraph */}
        <p
          className="font-['Instrument_Sans',sans-serif] text-[20px] leading-[30px] text-black text-center max-w-[788px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          streamlined communication between client, architect and
          site-supervisors. out-of-the-box project documentation and tracking
        </p>

        {/* CTA Buttons */}
        <div className="flex items-start gap-[16px]">
          <Link
            to="/projects"
            className="bg-primary hover:bg-primary-hover text-white px-[32px] py-[16px] rounded-[10px] font-['Instrument_Sans',sans-serif] font-medium text-[18px] leading-[28px] transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Start Building
          </Link>
          <button
            className="bg-white border-[1.833px] border-border text-primary px-[33.833px] py-[17.833px] rounded-[10px] font-['Instrument_Sans',sans-serif] font-medium text-[18px] leading-[28px] hover:bg-card-surface transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Learn More
          </button>
        </div>
      </div>
    </section>
  );
}

export default Hero;
