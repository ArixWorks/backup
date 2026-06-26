"use client"

import { useEffect, useRef } from "react"
import { apiPost } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"

const STORAGE_KEY = "pending_ref_code"

/**
 * Captures a `?ref=CODE` query param on landing and attaches it to the active
 * user once a session exists. The code is stashed so it survives the
 * account-selection step. Attaching is a safe no-op server-side if the user is
 * already referred or the code is invalid.
 */
export function ReferralCapture() {
  const { user } = useSession()
  const done = useRef(false)

  // Stash any ?ref= code as soon as we land (before a user is selected).
  useEffect(() => {
    if (typeof window === "undefined") return
    const code = new URLSearchParams(window.location.search).get("ref")
    if (code) {
      try {
        sessionStorage.setItem(STORAGE_KEY, code.trim())
      } catch {
        // ignore storage failures
      }
    }
  }, [])

  // Once a user is active, flush the pending code to the server (once).
  useEffect(() => {
    if (!user || done.current) return
    let code: string | null = null
    try {
      code = sessionStorage.getItem(STORAGE_KEY)
    } catch {
      code = null
    }
    if (!code) return
    done.current = true
    apiPost("/api/v1/referral", { code })
      .catch(() => {})
      .finally(() => {
        try {
          sessionStorage.removeItem(STORAGE_KEY)
        } catch {
          // ignore
        }
      })
  }, [user])

  return null
}
