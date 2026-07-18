export interface OfflineCreateNoticeProps {
  /** Plural noun for the entity, e.g. "Projects", "Build units", "Channels". */
  noun: string
}

/** Shown when a create is attempted offline — projects, build units and channels
 *  are all created online-only. */
export function OfflineCreateNotice({ noun }: OfflineCreateNoticeProps) {
  return (
    <p className="text-sm text-red-600">
      {noun} can&apos;t be created while offline. Reconnect to the internet and try again.
    </p>
  )
}
