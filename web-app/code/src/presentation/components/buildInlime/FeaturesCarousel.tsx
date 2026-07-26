import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const slides = [
  {
    heading: "Organization based on BuildUnits",
    description:
      "Organize your project into BuildUnits which directly correspond to the units of construction",
  },
  {
    heading: "Real-time Collaboration",
    description:
      "Organize communication among clients, architects and site-supervisors across different aspects of the construction project",
  },
  {
    heading: "Documentation and Tracking",
    description:
      "Out-of-the-box documentation, ledger keeping and tracking at different levels of granularity",
  },
];

export function FeaturesCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : slides.length - 1));
  };

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev < slides.length - 1 ? prev + 1 : 0));
  };

  return (
    <section className="w-full px-6 lg:px-[120px] py-[40px]">
      <div className="max-w-[1271px] mx-auto">
        <div className="relative bg-white rounded-[5px] overflow-hidden border border-gray-100">
          {/* Content */}
          {/*
            min-h rather than h: the slide copy wraps to roughly twice the lines
            on a phone, and a hard 400px clipped it behind the pagination
            controls. The floor keeps the box from resizing as slides change,
            which is what the fixed height was actually for. pb leaves room for
            the absolutely-positioned controls below.
          */}
          <div className="px-[24px] lg:px-[32px] pt-[24px] lg:pt-[32px] pb-[96px] lg:pb-[32px] min-h-[400px] flex flex-col">
            <h2
              className="font-['Instrument_Sans',sans-serif] font-semibold text-[24px] leading-[30px] lg:text-[30px] lg:leading-[36px] text-black mb-[16px]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {slides[currentSlide].heading}
            </h2>
            <p
              className="font-['Instrument_Sans',sans-serif] text-[16px] leading-[26px] lg:text-[18px] lg:leading-[28px] text-muted-foreground max-w-[666px]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {slides[currentSlide].description}
            </p>
          </div>

          {/* Pagination Dots — the dot itself is 8px tall, far under a usable
              touch target, so the visual moves into a span and the button
              becomes a 44px-tall invisible hit area around it.

              That padding is mouse-hostile rather than helpful, and it shifts
              where the dots sit, so at lg: the button collapses back onto the
              dot and the row is pixel-identical to the original design. */}
          <div className="absolute bottom-[16px] lg:bottom-[32px] left-[12px] lg:left-[32px] flex items-center lg:gap-[8px]">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className="flex items-center justify-center h-[44px] w-[22px] lg:h-[8px] lg:w-auto"
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === currentSlide}
              >
                <span
                  className={`block h-[8px] rounded-full transition-all ${
                    index === currentSlide
                      ? "bg-primary w-[24px]"
                      : "bg-secondary w-[8px]"
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="absolute bottom-[22px] lg:bottom-[32px] right-[24px] lg:right-[32px] flex items-center gap-[8px]">
            <button
              onClick={handlePrevSlide}
              className="bg-white border-[0.917px] border-border w-[44px] h-[44px] lg:w-[40px] lg:h-[40px] rounded-full flex items-center justify-center hover:bg-card-surface transition-colors"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4 text-primary" strokeWidth={2} />
            </button>
            <button
              onClick={handleNextSlide}
              className="bg-white border-[0.917px] border-border w-[44px] h-[44px] lg:w-[40px] lg:h-[40px] rounded-full flex items-center justify-center hover:bg-card-surface transition-colors"
              aria-label="Next slide"
            >
              <ChevronRight className="w-4 h-4 text-primary" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeaturesCarousel;
