import { useState } from "react"
import { File, FileText, Music } from "lucide-react"

/**
 * A preview of the actual uploaded file, not a generic mime icon — the web twin of
 * mobile's ResourceThumbnail.
 *
 * The file route (/api/resources/:id/file) is session-guarded, but it is SAME-ORIGIN
 * here, so the browser attaches the session cookie to <img>/<video> requests on its
 * own. Mobile has to load auth headers by hand for the same fetch; the web side gets
 * it for free, which is why this component is so much smaller than its counterpart.
 */

function IconThumb({ mimeType, size }: { mimeType: string; size: number }) {
  const Icon = mimeType.startsWith(`audio/`)
    ? Music
    : mimeType === `application/pdf` ||
        mimeType.includes(`word`) ||
        mimeType.includes(`text`)
      ? FileText
      : File

  return (
    <div
      className="flex items-center justify-center rounded-md border border-card-border bg-card-surface flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <Icon className="text-[#976623]" style={{ width: size * 0.45, height: size * 0.45 }} />
    </div>
  )
}

export interface ResourceThumbnailProps {
  /** Resource.file_location — a same-origin path such as /api/resources/:id/file. */
  fileLocation?: string | null
  /**
   * A still-uploading file's local blob: URL (PendingResource.objectUrl). Preferred
   * over fileLocation when present — the bytes are already in the browser, so the
   * preview appears immediately and costs no request. Mobile does the same with its
   * on-device localUri.
   */
  localUrl?: string | null
  mimeType: string
  size?: number
}

export function ResourceThumbnail({
  fileLocation,
  localUrl,
  mimeType,
  size = 40,
}: ResourceThumbnailProps) {
  const [failed, setFailed] = useState(false)

  const src = localUrl ?? fileLocation
  if (!src || failed) return <IconThumb mimeType={mimeType} size={size} />

  const isImage = mimeType.startsWith(`image/`)
  const isVideo = mimeType.startsWith(`video/`)
  if (!isImage && !isVideo) return <IconThumb mimeType={mimeType} size={size} />

  return (
    <div
      className="relative overflow-hidden rounded-md bg-card-surface flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {isImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <>
          {/* #t=0.5 seeks half a second in, which is what makes the browser paint a
              real frame — without the fragment most browsers render a blank box until
              the video is played. muted + preload=metadata keeps it cheap. */}
          <video
            src={`${src}#t=0.5`}
            muted
            preload="metadata"
            onError={() => setFailed(true)}
            className="w-full h-full object-cover"
          />
          <span className="absolute bottom-0.5 right-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-black/60">
            <span className="w-0 h-0 border-y-[3px] border-y-transparent border-l-[5px] border-l-white ml-[1px]" />
          </span>
        </>
      )}
    </div>
  )
}
