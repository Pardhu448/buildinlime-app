import { BrickPattern } from "./BrickPattern";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  orientation?: "horizontal" | "vertical";
}

export function Logo({ className = "", size = "md", orientation = "vertical" }: LogoProps) {
  const sizes = {
    sm: {
      container: orientation === "horizontal" ? "w-auto" : "w-32",
      brick: "h-[20px] w-[32px]",
      text: "text-base",
    },
    md: {
      container: orientation === "horizontal" ? "w-auto" : "w-48",
      brick: "h-[24px] w-[38px]",
      text: "text-lg",
    },
    lg: {
      container: orientation === "horizontal" ? "w-auto" : "w-64",
      brick: "h-[48px] w-[76px]",
      text: "text-4xl",
    },
  };

  const config = sizes[size];
  const flexDirection = orientation === "horizontal" ? "flex-row items-center gap-3" : "flex-col items-start gap-2";

  return (
    <div className={`inline-flex ${flexDirection} ${config.container} ${className}`}>
      <BrickPattern className={config.brick} />
      <span 
        className={`font-['Inria_Sans',sans-serif] font-bold text-[#1e1e1e] ${config.text}`}
        style={{ letterSpacing: '-0.02em' }}
      >
        BuildInLime
      </span>
    </div>
  );
}