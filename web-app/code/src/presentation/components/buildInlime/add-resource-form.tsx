import { useState, useRef } from "react"
import { Paperclip, X } from "lucide-react"

const ACCEPTED_TYPES = [
  "image/*",
  "video/*",
  "audio/*",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
].join(",")

interface AddResourceFormProps {
  onSubmit: (file: File, meta: { name: string; description: string }) => void
  onCancel: () => void
}

export function AddResourceForm({ onSubmit, onCancel }: AddResourceFormProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    // Pre-fill name from filename if not yet set
    if (!name) setName(file.name.replace(/\.[^.]+$/, ""))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !name.trim()) return
    onSubmit(selectedFile, { name: name.trim(), description: description.trim() })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 p-3 bg-[#fdf8f2] border border-[#e5d4c1] rounded-lg space-y-2"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Resource name"
        required
        autoFocus
        className="w-full text-sm px-2 py-1.5 border border-[#e5d4c1] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#976623] text-[#1e1e1e] placeholder:text-[#717182]"
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full text-sm px-2 py-1.5 border border-[#e5d4c1] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#976623] text-[#1e1e1e] placeholder:text-[#717182]"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-[#717182] border border-[#e5d4c1] rounded bg-white hover:bg-[#f0e5d8] transition-colors"
        >
          <Paperclip className="w-3 h-3" />
          {selectedFile ? selectedFile.name : "Attach file"}
        </button>
        {selectedFile && (
          <button
            type="button"
            onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = "" }}
            className="text-[#717182] hover:text-[#1e1e1e]"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!selectedFile || !name.trim()}
          className="px-3 py-1.5 text-xs bg-[#976623] text-white rounded hover:bg-[#7d5419] disabled:opacity-40 transition-colors"
        >
          Attach
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-[#717182] hover:text-[#1e1e1e] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
