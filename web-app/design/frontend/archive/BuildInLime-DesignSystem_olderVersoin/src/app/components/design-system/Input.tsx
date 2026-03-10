import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="font-['Instrument_Sans',sans-serif] font-medium text-sm text-black">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            px-4 py-3 
            bg-[#f3f3f5] 
            border border-[#ac7f5e] 
            rounded-lg 
            font-['Instrument_Sans',sans-serif] 
            text-base 
            text-black 
            placeholder:text-[#717182]
            focus:outline-none 
            focus:ring-2 
            focus:ring-[#976623] 
            focus:border-transparent
            disabled:opacity-50 
            disabled:cursor-not-allowed
            transition-all
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <span className="font-['Instrument_Sans',sans-serif] text-sm text-red-500">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

interface TextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="font-['Instrument_Sans',sans-serif] font-medium text-sm text-black">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            px-4 py-3 
            bg-[#f3f3f5] 
            border border-[#ac7f5e] 
            rounded-lg 
            font-['Instrument_Sans',sans-serif] 
            text-base 
            text-black 
            placeholder:text-[#717182]
            focus:outline-none 
            focus:ring-2 
            focus:ring-[#976623] 
            focus:border-transparent
            disabled:opacity-50 
            disabled:cursor-not-allowed
            transition-all
            min-h-[120px]
            resize-y
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <span className="font-['Instrument_Sans',sans-serif] text-sm text-red-500">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
