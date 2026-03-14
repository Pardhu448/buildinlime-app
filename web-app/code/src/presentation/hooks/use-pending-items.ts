import { useState, useCallback } from 'react'

export type PendingItem = {
  id: string
  name: string
  description: string | null
}

export function usePendingItems() {
  const [pendingItems, setPendingItems] = useState<Map<string, PendingItem>>(new Map())

  const addPending = useCallback((item: PendingItem) => {
    setPendingItems((prev) => new Map(prev).set(item.id, item))
  }, [])

  const removePending = useCallback((id: string) => {
    setPendingItems((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const pendingIds = new Set(pendingItems.keys())

  return { pendingItems, pendingIds, addPending, removePending }
}
