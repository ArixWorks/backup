"use client"

import { useCallback, useMemo, useState } from "react"

/**
 * Reusable multi-select state for admin list pages.
 *
 * Tracks a set of selected ids relative to the *currently visible* rows so
 * "select all" and the indeterminate header state stay correct even while the
 * list is filtered/searched. Selection is kept in a Set for O(1) toggles.
 */
export function useBulkSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const selectAll = useCallback(() => {
    setSelected(new Set(visibleIds))
  }, [visibleIds])

  // Keep only ids that are still visible (e.g. after a filter change or delete).
  const selectedVisible = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected],
  )

  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length
  const someSelected = selectedVisible.length > 0 && !allSelected

  const toggleAll = useCallback(() => {
    if (allSelected) clear()
    else selectAll()
  }, [allSelected, clear, selectAll])

  return {
    /** Ids currently selected AND visible (safe to send to the API). */
    selectedIds: selectedVisible,
    count: selectedVisible.length,
    isSelected: useCallback((id: string) => selected.has(id), [selected]),
    toggle,
    toggleAll,
    selectAll,
    clear,
    allSelected,
    someSelected,
  }
}

export type BulkSelection = ReturnType<typeof useBulkSelection>
