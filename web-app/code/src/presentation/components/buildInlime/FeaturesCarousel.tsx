import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const slides = [
  {
    heading: "Organization based on BuildUnits",
    description:
      "Organize your project with BuildUnits which directly correspond to the units of construction",
  },
  {
    heading: "Real-time Collaboration",
    description:
      "Connect clients, architects, and site-supervisors in one unified platform for seamless communication",
  },
  {
    heading: "Document Tracking",
    description:
      "Out-of-the-box project documentation and tracking for all your construction needs",
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
    <section className="w-full px-[120px] py-[40px]">
      <div className="max-w-[1271px] mx-auto">
        <div className="relative bg-white rounded-[5px] overflow-hidden border border-gray-100">
          {/* Content */}
          <div className="px-[32px] py-[32px] h-[400px] flex flex-col">
            <h2
              className="font-['Instrument_Sans',sans-serif] font-semibold text-[30px] leading-[36px] text-black mb-[16px]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {slides[currentSlide].heading}
            </h2>
            <p
              className="font-['Instrument_Sans',sans-serif] text-[18px] leading-[28px] text-[#717182] max-w-[666px]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {slides[currentSlide].description}
            </p>
          </div>

          {/* Pagination Dots */}
          <div className="absolute bottom-[32px] left-[32px] flex items-center gap-[8px]">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-[8px] rounded-full transition-all ${
                  index === currentSlide
                    ? "bg-[#976623] w-[24px]"
                    : "bg-[#ac7f5e] w-[8px]"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="absolute bottom-[32px] right-[32px] flex items-center gap-[8px]">
            <button
              onClick={handlePrevSlide}
              className="bg-white border-[0.917px] border-[#ac7f5e] w-[40px] h-[40px] rounded-full flex items-center justify-center hover:bg-[#fdf8f2] transition-colors"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4 text-[#976623]" strokeWidth={2} />
            </button>
            <button
              onClick={handleNextSlide}
              className="bg-white border-[0.917px] border-[#ac7f5e] w-[40px] h-[40px] rounded-full flex items-center justify-center hover:bg-[#fdf8f2] transition-colors"
              aria-label="Next slide"
            >
              <ChevronRight className="w-4 h-4 text-[#976623]" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeaturesCarousel;
