"use client"

import useSWR from "swr"
import { fetcher, apiDelete } from "@/lib/api-client"
import type { Tier } from "@/lib/tiers"

export type SessionMembership = {
  /** Effective tier shown across the app (VIP when an active grant exists). */
  tier: Tier
  /** Auto-earned tier (STANDARD..DIAMOND), independent of VIP. */
  earnedTier: Tier
  /** Whether an exclusive VIP membership is currently active. */
  vipActive: boolean
  /** ISO date when the manual VIP expires, or null for no expiry. */
  vipManualExpiresAt: string | null
  /** Product discount percent unlocked by the effective tier. */
  discountPercent: number
}

export type SessionUser = {
  id: string
  displayName: string
  alias: string
  role: "USER" | "ADMIN" | "SUPPORT"
  status: string
  languageCode: string | null
  email: string | null
  emailVerified: boolean
  mustChangePassword: boolean
  telegramId: string | null
  telegramUsername: string | null
  photoUrl: string | null
  isPremium: boolean
  membership: SessionMembership
  balances: {
    totalBalance: number
    frozenBalance: number
    availableBalance: number
  } | null
}

export function useSession() {
  const { data, error, isLoading, mutate } = useSWR<{ ok: boolean; data: SessionUser | null }>(
    "/api/v1/auth/session",
    fetcher,
    { refreshInterval: 15000 },
  )

  async function logout() {
    await apiDelete("/api/v1/auth/session")
    await mutate({ ok: true, data: null }, { revalidate: false })
  }

  return {
    user: data?.data ?? null,
    isLoading,
    error,
    refresh: mutate,
    logout,
  }
}
