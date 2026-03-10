import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useLiveQuery, eq } from "@tanstack/react-db";
import { useSession } from "%/infrastructure/auth/client";
import { channelsCollection } from "%/infrastructure/database/tanstack-db-electric/admincollections";

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

export function NewChannelButton({ buildUnitId }: { buildUnitId: string }) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateError, setDuplicateError] = useState(false);
  const [formData, setFormData] = useState<NewChannelFormData>({
    name: "Requirements",
    description: "",
  });
  const { data: session } = useSession();

  const { data: existingChannels } = useLiveQuery(
    (q) =>
      q
        .from({ channelsCollection })
        .where(({ channelsCollection: c }) => eq(c.buildunit_id, buildUnitId)),
    [buildUnitId]
  );

  // Electric returns jsonb columns as JSON-encoded strings e.g. '"Requirements"'.
  // Unwrap before comparing against the plain formData.name value.
  const existingNames = new Set(
    (existingChannels ?? []).map((c) => {
      const raw = c.name as unknown as string
      return raw.startsWith('"') ? JSON.parse(raw) : raw
    })
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user || !buildUnitId) return;

    if (existingNames.has(formData.name)) {
      setDuplicateError(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await channelsCollection.insert({
        id: crypto.randomUUID(),
        name: formData.name,
        description: formData.description,
        buildunit_id: buildUnitId,
        owner_id: session.user.id,
        created_at: new Date(),
      });
      setFormData({ name: "Requirements", description: "" });
      setDuplicateError(false);
      setIsPopupOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "name") {
      setDuplicateError(false);
      setFormData((prev) => ({ ...prev, name: value as NewChannelFormData["name"] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

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
          New Channel
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
              Create New Channel
            </h2>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Channel Type Select */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Channel Type
                </label>
                <select
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#976623] focus:border-transparent ${duplicateError ? "border-red-500" : "border-gray-300"}`}
                >
                  {CHANNEL_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {duplicateError && (
                  <p className="mt-1 text-sm text-red-600">
                    A {formData.name} channel already exists for this build unit.
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
                  placeholder="Enter a short description of the channel"
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
                {isSubmitting ? "Creating…" : "Create Channel"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
