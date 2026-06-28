"use client"

import { Bell } from "lucide-react"
import { NotificationsList } from "@/components/notifications-list"
import { SignInRequired } from "@/components/empty-state"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"

export default function NotificationsPage() {
  const { user } = useSession()
  const { t } = useI18n()

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <Bell className="h-5 w-5 text-primary" />
          {t("notif.title")}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("notif.subtitle")}
        </p>
      </header>

      {!user ? (
        <SignInRequired description={t("notif.signInRequired")} />
      ) : (
        <NotificationsList />
      )}
    </div>
  )
}
