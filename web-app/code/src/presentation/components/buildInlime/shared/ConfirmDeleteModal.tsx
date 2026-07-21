import { AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "./Modal";

interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** The thing being deleted, e.g. the project or channel name. */
  entityName: string;
  /**
   * A human phrase for the child entities that go with it, e.g.
   * "build units, channels and tasks". Omit for a leaf with no children.
   */
  constituents?: string;
  /** Disables the buttons and shows a spinner while the delete is in flight. */
  busy?: boolean;
}

/**
 * A destructive-action confirmation dialog, built on the shared Modal. Replaces
 * the browser `window.confirm` the delete flows used to call: it spells out that
 * the child entities go too, that the records are retained (soft-deleted) for
 * auditing, and that only attachments are on a 30-day retrieval clock — none of
 * which a one-line native confirm can convey.
 */
export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  entityName,
  constituents,
  busy,
}: ConfirmDeleteModalProps) {
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-800">
            Delete &ldquo;{entityName}&rdquo;?
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {constituents ? (
              <>
                This will also remove all its {constituents} for everyone.
              </>
            ) : (
              <>Everyone loses access immediately.</>
            )}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Any attachments stay retrievable for{" "}
        <span className="font-medium text-foreground">30 days</span>, after which
        they are permanently deleted.
      </p>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="px-4 h-[40px] rounded-[10px] border border-border text-foreground font-medium text-[14px] hover:bg-card-surface transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="px-4 h-[40px] rounded-[10px] bg-red-600 hover:bg-red-700 text-white font-medium text-[14px] flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Delete
        </button>
      </div>
    </Modal>
  );
}
