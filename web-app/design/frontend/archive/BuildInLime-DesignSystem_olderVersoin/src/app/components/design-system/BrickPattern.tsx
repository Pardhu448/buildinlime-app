import imgBrick from "figma:asset/044683d680bab81b91974a32f614f0acede8855d.png";

interface BrickPatternProps {
  className?: string;
}

export function BrickPattern({ className = "" }: BrickPatternProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img
          alt="Brick pattern decoration"
          className="absolute left-0 max-w-none size-full top-0 object-cover"
          src={imgBrick}
        />
      </div>
    </div>
  );
}

// Export the URL so other components can use it directly (e.g. as a CSS background)
export const BRICK_PATTERN_URL = imgBrick;
