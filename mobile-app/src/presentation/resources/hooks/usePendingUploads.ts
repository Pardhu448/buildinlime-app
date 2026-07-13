import { useEffect, useState } from "react"
import {
  subscribe,
  enqueueUpload,
  startUpload,
  retryUpload,
  cancelUpload,
  scheduleUpload,
  renameUpload,
  type PendingUpload,
} from "@/src/infrastructure/offline/upload-manager"

// Thin observer over the upload-manager service. All logic — copying files,
// uploading, retrying, persistence — lives in the service so uploads survive
// screen unmounts; this hook only exposes the slice of pending state a screen
// cares about and re-renders on change.

export interface UsePendingUploadsFilter {
  /** Standalone (channel-level) uploads: those with no message association. */
  channelId?: string
  /** Uploads attached to a specific message. */
  messageId?: string
}

export function usePendingUploads(filter: UsePendingUploadsFilter) {
  const [all, setAll] = useState<PendingUpload[]>([])

  useEffect(() => subscribe(setAll), [])

  const { channelId, messageId } = filter
  const pendingUploads = all.filter((u) => {
    if (messageId) return u.messageId === messageId
    if (channelId) return u.channelId === channelId && !u.messageId
    return false
  })

  return {
    pendingUploads,
    enqueue: enqueueUpload,
    start: startUpload,
    retry: retryUpload,
    cancel: cancelUpload,
    schedule: scheduleUpload,
    rename: renameUpload,
  }
}

/**
 * All in-flight uploads in a channel that are attached to a message — used by
 * MessageList to show attachments inside their message bubble before the
 * server-created `resources` row has synced back.
 */
export function useChannelMessageUploads(channelId: string): PendingUpload[] {
  const [all, setAll] = useState<PendingUpload[]>([])

  useEffect(() => subscribe(setAll), [])

  return all.filter((u) => u.channelId === channelId && !!u.messageId)
}
