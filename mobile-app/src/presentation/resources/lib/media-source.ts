import { useEffect, useState } from "react"
import { getAuthHeaders } from "@/src/infrastructure/auth/cookie-fetch"

// Where the file bytes live. Resource.file_location is a server-relative path
// (e.g. "/api/resources/<id>/file"), so a full URL is base + location.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000"

export function resourceUrl(fileLocation: string): string {
  return `${API_URL}${fileLocation}`
}

/**
 * The file route is session-guarded (serveResourceFile 401s without a cookie),
 * so every remote media source — <Image>, expo-video, expo-audio — must carry
 * auth headers rather than a bare uri string. Returns null until the async
 * cookie load resolves; callers show a spinner in the meantime.
 */
export function useAuthHeaders(): Record<string, string> | null {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null)
  useEffect(() => {
    let cancelled = false
    void getAuthHeaders().then((h) => {
      if (!cancelled) setHeaders(h as Record<string, string>)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return headers
}
