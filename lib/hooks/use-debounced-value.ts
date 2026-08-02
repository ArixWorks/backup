"use client"

import { useEffect, useState } from "react"

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` of no
 * changes. Used to avoid firing a network request on every keystroke in search
 * inputs.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}
