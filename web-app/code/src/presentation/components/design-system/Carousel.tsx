import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "./Button";

interface CarouselItem {
  title: string;
  description?: string;
  content?: ReactNode;
}

interface CarouselProps {
  items: CarouselItem[];
  className?: string;
  autoPlay?: boolean;
  interval?: number;
}

export function Carousel({ items, className = "", autoPlay = false, interval = 5000 }: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className={`relative border border-[#ac7f5e] rounded-lg overflow-hidden ${className}`}>
      {/* Carousel Content */}
      <div className="relative min-h-[400px] bg-white p-8">
        <div className="max-w-2xl">
          <h2 className="font-['Instrument_Sans',sans-serif] text-3xl font-semibold text-black mb-4">
            {items[currentIndex].title}
          </h2>
          {items[currentIndex].description && (
            <p className="font-['Instrument_Sans',sans-serif] text-lg text-[#717182] mb-6">
              {items[currentIndex].description}
            </p>
          )}
          {items[currentIndex].content}
        </div>
      </div>

      {/* Navigation Dots */}
      <div className="absolute bottom-6 left-8 flex gap-2">
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex 
                ? 'bg-[#976623] w-6' 
                : 'bg-[#ac7f5e]'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Navigation Arrows */}
      <div className="absolute bottom-6 right-8 flex gap-2">
        <button
          onClick={goToPrevious}
          className="w-10 h-10 rounded-full bg-white border border-[#ac7f5e] flex items-center justify-center hover:bg-[#f5f5f5] transition-colors"
          aria-label="Previous slide"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="#976623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          onClick={goToNext}
          className="w-10 h-10 rounded-full bg-white border border-[#ac7f5e] flex items-center justify-center hover:bg-[#f5f5f5] transition-colors"
          aria-label="Next slide"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 4L10 8L6 12" stroke="#976623" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
