import { HTMLAttributes, forwardRef } from "react";

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4;
  variant?: "default" | "brand";
}

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className = "", level = 1, variant = "default", children, ...props }, ref) => {
    const baseStyles = "leading-[1.5]";
    
    const variantStyles = {
      default: "font-['Instrument_Sans',sans-serif] font-semibold text-black",
      brand: "font-['Inria_Sans',sans-serif] font-bold text-[#1e1e1e]",
    };

    const levelStyles = {
      1: "text-4xl md:text-5xl",
      2: "text-3xl md:text-4xl",
      3: "text-2xl md:text-3xl",
      4: "text-xl md:text-2xl",
    };

    const Tag = `h${level}` as keyof JSX.IntrinsicElements;

    return (
      <Tag
        ref={ref as any}
        className={`${baseStyles} ${variantStyles[variant]} ${levelStyles[level]} ${className}`}
        {...props}
      >
        {children}
      </Tag>
    );
  }
);

Heading.displayName = "Heading";

interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  variant?: "body" | "small" | "caption";
  as?: "p" | "span" | "div";
}

export const Text = forwardRef<HTMLParagraphElement, TextProps>(
  ({ className = "", variant = "body", as = "p", children, ...props }, ref) => {
    const baseStyles = "font-['Instrument_Sans',sans-serif] leading-[1.5]";
    
    const variantStyles = {
      body: "text-base text-black",
      small: "text-sm text-[#717182]",
      caption: "text-xs text-[#717182]",
    };

    const Tag = as as keyof JSX.IntrinsicElements;

    return (
      <Tag
        ref={ref as any}
        className={`${baseStyles} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </Tag>
    );
  }
);

Text.displayName = "Text";
