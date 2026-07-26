import { Link } from "@tanstack/react-router";

export function Hero() {
  return (
    <section className="w-full bg-gradient-to-b from-white to-muted px-6 lg:px-[120px] pt-[48px] lg:pt-[80px] pb-[48px] lg:pb-[80px]">
      <div className="max-w-[1270px] mx-auto flex flex-col items-center gap-[24px]">
        {/* Heading */}
        {/* 48px/72px is a desktop display size; at 390px it wraps to five lines
            and the 72px leading opens gaps wide enough to read as separate
            paragraphs. The mobile step keeps the leading proportional. */}
        <h1 className="font-['Inria_Sans',sans-serif] font-bold text-[32px] leading-[42px] lg:text-[48px] lg:leading-[72px] text-foreground text-center max-w-[786px]">
          Collaboration Platform to Build Natural Homes
        </h1>

        {/* Paragraph */}
        <p
          className="font-['Instrument_Sans',sans-serif] text-[17px] leading-[26px] lg:text-[20px] lg:leading-[30px] text-black text-center max-w-[788px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          streamlined communication between client, architect and
          site-supervisors. out-of-the-box data collation, project documentation
          and realtime-tracking
        </p>

        {/* CTA Buttons — side by side once there is room, stacked full-width on
            a phone so neither button ends up a cramped tap target. */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-[16px] w-full sm:w-auto">
          <Link
            to="/projects"
            className="text-center bg-primary hover:bg-primary-hover text-white px-[32px] py-[16px] rounded-[10px] font-['Instrument_Sans',sans-serif] font-medium text-[18px] leading-[28px] transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Start Building
          </Link>
          <Link
            to="/features"
            className="text-center bg-white border-[1.833px] border-border text-primary px-[33.833px] py-[17.833px] rounded-[10px] font-['Instrument_Sans',sans-serif] font-medium text-[18px] leading-[28px] hover:bg-card-surface transition-colors"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Learn More
          </Link>
        </div>
      </div>
    </section>
  );
}

export default Hero;
