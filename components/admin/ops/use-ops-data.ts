"use client"

import { useEffect } from "react"
import useSWR, { type SWRConfiguration } from "swr"
import { fetcher } from "@/lib/api-client"
import { useOpsRealtime, type OpsEventKind } from "./ops-realtime"

/**
 * SWR wrapper for Operations Center endpoints. When the realtime transport is
 * connected, the matching realtime event kinds trigger a revalidation so the
 * UI updates instantly. When realtime is unavailable it falls back to the
 * provided polling interval (graceful degradation).
 */
export function useOpsData<T>(
  key: string | null,
  opts?: {
    /** Realtime event kinds that should trigger a refresh of this resource. */
    on?: OpsEventKind[]
    /** Polling fallback interval (ms). Used regardless as a safety net. */
    refreshInterval?: number
    swr?: SWRConfiguration
  },
) {
  const { subscribe, connected } = useOpsRealtime()
  const { on = [], refreshInterval = 15000, swr } = opts ?? {}

  // When realtime is live, relax polling; keep a slow safety-net poll otherwise.
  const interval = connected ? Math.max(refreshInterval, 30000) : refreshInterval

  const result = useSWR<{ data: T }>(key, fetcher, {
    refreshInterval: interval,
    keepPreviousData: true,
    ...swr,
  })

  useEffect(() => {
    if (!key || on.length === 0) return
    const unsub = subscribe((evt) => {
      if (on.includes(evt.kind)) {
        void result.mutate()
      }
    })
    return unsub
  }, [key, on, subscribe, result])

  return { ...result, data: result.data?.data }
}
