import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  /** Runs for both the close button and a click on the backdrop. */
  onClose: () => void;
  /**
   * Renders the standard heading. Omit it and pass your own <h2> in children if
   * the dialog needs a different one — TeamSection and Sidebar both do.
   */
  title?: string;
  children: ReactNode;
}

/**
 * The centred dialog these screens each hand-rolled: backdrop, click-outside to
 * dismiss, white card, close button.
 *
 * Lifted verbatim from eight identical copies — same elements, same class
 * strings, same order — so it renders exactly what it replaced. Deliberately NOT
 * ui/dialog.tsx: that one is Radix-based with its own tokens and animations, so
 * adopting it would change how these look, which is a design decision and not a
 * refactor. Putting every caller behind this seam is what would make that swap a
 * one-file edit later.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {title && (
          <h2 className="text-xl font-semibold text-gray-800 mb-6">{title}</h2>
        )}

        {children}
      </div>
    </div>
  );
}
