import { Plus } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useSession } from "%/infrastructure/auth/client";
import { projectsCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections";
import { Modal } from "../shared/Modal";
import { Input, Textarea, Label } from "../shared/FormField";

interface NewProjectFormData {
  name: string;
  description: string;
}

export function NewProjectButton() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [offlineError, setOfflineError] = useState(false);
  const [formData, setFormData] = useState<NewProjectFormData>({
    name: "",
    description: "",
  });
  const { data: session } = useSession();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;

    // Projects can only be created while online. Surface a clear message and
    // keep the form open instead of queueing the creation offline.
    if (!navigator.onLine) {
      setOfflineError(true);
      return;
    }

    setOfflineError(false);
    setIsSubmitting(true);
    try {
      await projectsCollection.insert({
        id: crypto.randomUUID(),
        name: formData.name,
        description: formData.description,
        owner_id: session.user.id,
        created_at: new Date(),
      });
      setFormData({ name: "", description: "" });
      setIsPopupOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setOfflineError(false);
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <button
        onClick={() => {
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
          New Project
        </span>
      </button>

      <Modal
        open={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        title="Create New Project"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name Input */}
          <div>
            <Label
              htmlFor="name"
            >
              Project Name
            </Label>
            <Input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter project name"
              required
            />
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
              placeholder="Enter a short description of the project"
              rows={3}
              required
            />
          </div>

          {/* Offline notice */}
          {offlineError && (
            <p className="text-sm text-red-600">
              Projects can&apos;t be created while offline. Reconnect to the
              internet and try again.
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {isSubmitting ? "Creating…" : "Create Project"}
          </button>
        </form>
      </Modal>
    </>
  );
}
