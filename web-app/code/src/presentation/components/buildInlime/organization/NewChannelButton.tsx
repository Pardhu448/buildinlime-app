import { Plus } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useLiveQuery, eq } from "@tanstack/react-db";
import { useSession } from "%/infrastructure/auth/client";
import { buildUnitsCollection, channelsCollection, projectsCollection, registerChannelInsertCallback } from "%/infrastructure/database/tanstack-db-electric/admincollections";
import { Modal } from "../shared/Modal";
import { Select, Textarea, Label } from "../shared/FormField";
import type { PendingItem } from "%/presentation/hooks/use-pending-items";

interface NewChannelFormData {
  name: "Finance" | "Requirements" | "Design" | "Materials" | "Tools" | "Execution" | "Experimentation";
  description: string;
}

const CHANNEL_TYPES = [
  { value: "Finance", label: "Finance" },
  { value: "Requirements", label: "Requirements" },
  { value: "Design", label: "Design" },
  { value: "Materials", label: "Materials" },
  { value: "Tools", label: "Tools" },
  { value: "Execution", label: "Execution" },
  { value: "Experimentation", label: "Experimentation" },
] as const;

interface NewChannelButtonProps {
  buildUnitId: string;
  addPending: (item: PendingItem) => void;
  removePending: (id: string) => void;
  onTrpcComplete: (id: string) => void;
}

export function NewChannelButton({ buildUnitId, addPending, removePending, onTrpcComplete }: NewChannelButtonProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [duplicateError, setDuplicateError] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [formData, setFormData] = useState<NewChannelFormData>({
    name: "Requirements",
    description: "",
  });
  const { data: session } = useSession();

  const { data: buildUnitData } = useLiveQuery(
    (q) => q.from({ buildUnitsCollection }).where(({ buildUnitsCollection: bu }) => eq(bu.id, buildUnitId)),
    [buildUnitId]
  );
  const projectId = buildUnitData?.[0]?.project_id;

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
    if (!session?.user || !buildUnitId) return;

    // Channels are created online-only. Surface a clear message and keep the
    // form open instead of silently rolling back the optimistic insert.
    if (!navigator.onLine) {
      setOfflineError(true);
      return;
    }

    const payload = {
      id: crypto.randomUUID(),
      name: formData.name,
      description: formData.description,
      buildunit_id: buildUnitId,
      owner_id: session.user.id,
      created_at: new Date(),
    };

    setFormData({ name: "Requirements", description: "" });
    setDuplicateError(false);
    setOfflineError(false);
    setIsPopupOpen(false);

    addPending({ id: payload.id, name: payload.name, description: payload.description });
    registerChannelInsertCallback(
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
    channelsCollection.insert(payload);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setOfflineError(false);
    if (name === "name") {
      setDuplicateError(false);
      setFormData((prev) => ({ ...prev, name: value as NewChannelFormData["name"] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
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
        className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span
          className="font-['Instrument_Sans',sans-serif] font-medium text-[14px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          New Channel
        </span>
      </button>

      <Modal
        open={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        title="Create New Channel"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Channel Type Select */}
          <div>
            <Label
              htmlFor="name"
            >
              Channel Type
            </Label>
            <Select
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className={duplicateError ? "border-red-500" : undefined}
            >
              {CHANNEL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
            {duplicateError && (
              <p className="mt-1 text-sm text-red-600">
                A {formData.name} channel already exists for this build unit.
              </p>
            )}
          </div>

          {/* Description Input */}
          <div>
            <Label
              htmlFor="description"
            >
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter a short description of the channel"
              rows={3}
              required
            />
          </div>

          {/* Offline notice */}
          {offlineError && (
            <p className="text-sm text-red-600">
              Channels can&apos;t be created while offline. Reconnect to the
              internet and try again.
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Create Channel
          </button>
        </form>
      </Modal>
    </>
  );
}
