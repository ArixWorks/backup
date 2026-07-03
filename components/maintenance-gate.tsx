"use client"

import useSWR from "swr"
import { usePathname } from "next/navigation"
import { Wrench, LifeBuoy } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"

type MaintenanceState = {
  enabled: boolean
  title: string
  message: string
  supportUrl: string
}

/**
 * Client maintenance gate for the storefront / Mini App. When maintenance mode
 * is on, every non-admin sees a friendly notice instead of the app; admins pass
 * straight through so they can keep operating. The support routes stay reachable
 * so users can still reach help while the rest of the app is paused.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useSession()
  const { data } = useSWR<{ data: MaintenanceState }>("/api/v1/maintenance", fetcher, {
    refreshInterval: 30000,
  })

  const m = data?.data
  const isAdmin = user?.role === "ADMIN"
  const onSupport = pathname?.startsWith("/support") ?? false

  if (!m?.enabled || isAdmin || onSupport) return <>{children}</>

  return <MaintenanceScreen title={m.title} message={m.message} supportUrl={m.supportUrl} />
}

function MaintenanceScreen({
  title,
  message,
  supportUrl,
}: {
  title: string
  message: string
  supportUrl: string
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <section className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 text-center shadow-lg">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/25">
          <Wrench className="h-8 w-8 text-primary" strokeWidth={2} />
        </div>
        <h1 className="text-balance text-xl font-extrabold text-foreground">{title}</h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">{message}</p>

        {supportUrl ? (
          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <LifeBuoy className="h-4 w-4" />
            پشتیبانی
          </a>
        ) : null}

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          به‌زودی برمی‌گردیم
        </div>
      </section>
    </main>
  )
}
