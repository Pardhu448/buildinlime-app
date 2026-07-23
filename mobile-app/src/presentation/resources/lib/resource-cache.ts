import { useEffect, useState } from "react"
import {
  ensureCachedFile,
  ensureCachedPoster,
  peekCachedFile,
  peekCachedPoster,
} from "@/src/infrastructure/resources/resource-file-cache"

// React hooks over the resource file cache (the stateful cache itself lives in
// infrastructure/resources/resource-file-cache so the application layer can evict a
// deleted resource without importing presentation). Each hook returns a local
// file:// uri once the resource is on disk, resolving synchronously from the memo on
// a re-mount so reopening a thread or sheet is instant.

export interface CachedState {
  /** Local file:// uri once resolved; null while loading or on failure. */
  uri: string | null
  loading: boolean
  failed: boolean
}

/** Local file:// uri for a resource file, downloading + caching on first use. */
export function useCachedResourceFile(
  remoteUrl: string | null | undefined,
  mimeType?: string,
): CachedState {
  const [uri, setUri] = useState<string | null>(() =>
    remoteUrl ? peekCachedFile(remoteUrl) : null,
  )
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!remoteUrl) {
      setUri(null)
      return
    }
    const cached = peekCachedFile(remoteUrl)
    if (cached) {
      setUri(cached)
      setFailed(false)
      return
    }
    let cancelled = false
    setUri(null)
    setFailed(false)
    void ensureCachedFile(remoteUrl, mimeType)
      .then((local) => {
        if (!cancelled) setUri(local)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [remoteUrl, mimeType])

  return { uri, loading: !!remoteUrl && !uri && !failed, failed }
}

/** Local file:// uri for a video's poster frame, generated + cached on first use. */
export function useCachedVideoPoster(remoteUrl: string | null | undefined): CachedState {
  const [uri, setUri] = useState<string | null>(() =>
    remoteUrl ? peekCachedPoster(remoteUrl) : null,
  )
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!remoteUrl) {
      setUri(null)
      return
    }
    const cached = peekCachedPoster(remoteUrl)
    if (cached) {
      setUri(cached)
      setFailed(false)
      return
    }
    let cancelled = false
    setUri(null)
    setFailed(false)
    void ensureCachedPoster(remoteUrl)
      .then((local) => {
        if (!cancelled) setUri(local)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [remoteUrl])

  return { uri, loading: !!remoteUrl && !uri && !failed, failed }
}
