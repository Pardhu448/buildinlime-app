import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
} from "react";
import { cn } from "%/presentation/lib/utils";

/**
 * The form controls these screens had each pasted inline: one class string
 * copied across 10 inputs, 8 selects and 4 textareas, plus 12 copies of the
 * label.
 *
 * Lifted verbatim, so they render exactly what they replaced. Each takes a
 * className that tailwind-merge folds over the base, which is how the two sites
 * that swap the border colour on a duplicate-name error keep working:
 *
 *     <Input className={duplicateError ? "border-red-500" : undefined} />
 *
 * border-red-500 and the base's border-gray-300 are the same utility, so merge
 * keeps the caller's. Passing an unrelated class just adds it.
 *
 * These are NOT ui/input.tsx and ui/label.tsx. Those exist, unused, but are
 * token-driven (border-input, bg-background) and would look different — a design
 * change, not a refactor. With every caller behind this seam, moving to them
 * later is a one-file edit.
 */
const INPUT_BASE =
  "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(INPUT_BASE, className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(INPUT_BASE, "resize-none", className)} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(INPUT_BASE, className)} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={cn("block text-sm font-medium text-gray-700 mb-1", className)}
    />
  );
}
