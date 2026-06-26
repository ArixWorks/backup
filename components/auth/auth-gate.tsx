"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useSession } from "@/hooks/use-session"

/**
 * Client-side login gate. Renders children only for authenticated users; sends
 * everyone else to /login. The Telegram Mini App provider performs an automatic
 * initData login on first load, so real Telegram users won't see the gate.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !user) {
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""
      router.replace(`/login${next}`)
    }
  }, [isLoading, user, pathname, router])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}
