import type { HTMLAttributes} from "react";
import { forwardRef } from "react";

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "bordered" | "framed";
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ className = "", variant = "default", maxWidth = "2xl", children, ...props }, ref) => {
    const variants = {
      default: "",
      bordered: "border border-[#ac7f5e]",
      framed: "border-2 border-[#976623]",
    };

    const maxWidths = {
      sm: "max-w-screen-sm",
      md: "max-w-screen-md",
      lg: "max-w-screen-lg",
      xl: "max-w-screen-xl",
      "2xl": "max-w-screen-2xl",
      full: "max-w-full",
    };

    return (
      <div
        ref={ref}
        className={`mx-auto px-6 ${maxWidths[maxWidth]} ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Container.displayName = "Container";
