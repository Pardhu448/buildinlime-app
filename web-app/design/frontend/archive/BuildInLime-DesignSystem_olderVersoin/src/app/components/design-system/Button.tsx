import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-['Instrument_Sans',sans-serif] font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      primary: "bg-[#976623] text-white hover:bg-[#7d5419] active:bg-[#654212]",
      secondary: "bg-[#ac7f5e] text-white hover:bg-[#936b4f] active:bg-[#7a5840]",
      outline: "border-2 border-[#ac7f5e] text-[#976623] hover:bg-[#ac7f5e] hover:text-white",
      ghost: "text-[#976623] hover:bg-[#f5f5f5]",
    };

    const sizes = {
      sm: "px-4 py-2 text-sm rounded-md",
      md: "px-6 py-3 text-base rounded-lg",
      lg: "px-8 py-4 text-lg rounded-lg",
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
