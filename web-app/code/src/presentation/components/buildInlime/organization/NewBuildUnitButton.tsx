import { Plus } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "@tanstack/react-router";
import { useLiveQuery, eq } from "@tanstack/react-db";
import { useSession } from "%/infrastructure/auth/client";
import { projectsCollection, buildUnitsCollection, registerBuildUnitInsertCallback } from "%/infrastructure/database/tanstack-db-electric/admincollections";
import { Modal } from "../shared/Modal";

interface NewBuildUnitFormData {
  name: string;
  description: string;
}

import type { PendingBuildUnit } from "%/presentation/hooks/use-pending-build-units";

interface NewBuildUnitButtonProps {
  addPending: (item: PendingBuildUnit) => void;
  removePending: (id: string) => void;
  onTrpcComplete: (id: string) => void;
}

export function NewBuildUnitButton({ addPending, removePending, onTrpcComplete }: NewBuildUnitButtonProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [duplicateError, setDuplicateError] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [formData, setFormData] = useState<NewBuildUnitFormData>({
    name: "",
    description: "",
  });
  const { data: session } = useSession();
  const { projectId } = useParams({ strict: false });

  const { data: projectData } = useLiveQuery(
    (q) =>
      projectId
        ? q.from({ projectsCollection }).where(({ projectsCollection: p }) => eq(p.id, projectId))
        : q.from({ projectsCollection }).where(({ projectsCollection: p }) => eq(p.id, `__none__`)),
    [projectId]
  );
  const isProjectOwner = !!session?.user?.id && projectData?.[0]?.owner_id === session.user.id;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user || !projectId) return;

    // Build units are created online-only. Surface a clear message and keep the
    // form open instead of silently rolling back the optimistic insert.
    if (!navigator.onLine) {
      setOfflineError(true);
      return;
    }

    const payload = {
      id: crypto.randomUUID(),
      name: formData.name,
      description: formData.description,
      project_id: projectId,
      owner_id: session.user.id,
      created_at: new Date(),
    };

    // Close modal immediately for instant feedback
    setFormData({ name: "", description: "" });
    setDuplicateError(false);
    setOfflineError(false);
    setIsPopupOpen(false);

    // Register callback: success is a no-op (ProjectRoute detects Electric sync and
    // removes the spinner); on error the optimistic insert is rolled back and we
    // reopen the form so the user can retry.
    addPending({ id: payload.id, name: payload.name, description: payload.description ?? null });
    registerBuildUnitInsertCallback(
      payload.id,
      () => onTrpcComplete(payload.id),
      (err: Error) => {
        removePending(payload.id);
        setFormData({ name: payload.name, description: payload.description });
        // If the connection dropped mid-request, explain that rather than
        // showing a misleading duplicate-name error.
        if (!navigator.onLine) {
          setOfflineError(true);
        } else {
          setDuplicateError(err.message.includes(`already exists`));
        }
        setIsPopupOpen(true);
      },
    );
    buildUnitsCollection.insert(payload);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "name") setDuplicateError(false);
    setOfflineError(false);
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (!isProjectOwner) return null;

  return (
    <>
      <button
        onClick={() => {
          setDuplicateError(false);
          setOfflineError(false);
          setIsPopupOpen(true);
        }}
        className="bg-[#976623] hover:bg-[#7d5419] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span
          className="font-['Instrument_Sans',sans-serif] font-medium text-[14px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          New BuildUnit
        </span>
      </button>

      <Modal
        open={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        title="Create New Build Unit"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Build Unit Name Input */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Build Unit Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter build unit name"
              required
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent ${duplicateError ? "border-red-500" : "border-gray-300"}`}
            />
            {duplicateError && (
              <p className="mt-1 text-sm text-red-600">
                A build unit with this name already exists in this project.
              </p>
            )}
          </div>

          {/* Description Input */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter a short description of the build unit"
              rows={3}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent resize-none"
            />
          </div>

          {/* Offline notice */}
          {offlineError && (
            <p className="text-sm text-red-600">
              Build units can&apos;t be created while offline. Reconnect to the
              internet and try again.
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-[#976623] hover:bg-[#7d5419] text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Create Build Unit
          </button>
        </form>
      </Modal>
    </>
  );
}
