import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "@tanstack/react-router";
import { useLiveQuery, eq } from "@tanstack/react-db";
import { useSession } from "%/infrastructure/auth/client";
import { buildUnitsCollection, projectsCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections";

interface NewBuildUnitFormData {
  name: string;
  description: string;
}

export function NewBuildUnitButton() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

    setIsSubmitting(true);
    try {
      await buildUnitsCollection.insert({
        id: crypto.randomUUID(),
        name: formData.name,
        description: formData.description,
        project_id: projectId,
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
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (!isProjectOwner) return null;

  return (
    <>
      <button
        onClick={() => setIsPopupOpen(true)}
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

      {isPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsPopupOpen(false)}
          />

          {/* Popup Content */}
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            {/* Close Button */}
            <button
              onClick={() => setIsPopupOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <h2 className="text-xl font-semibold text-gray-800 mb-6">
              Create New Build Unit
            </h2>

            {/* Form */}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent"
                />
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#976623] hover:bg-[#7d5419] disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {isSubmitting ? "Creating…" : "Create Build Unit"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
