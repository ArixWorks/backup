"use client"

import { Bell } from "lucide-react"
import { NotificationsList } from "@/components/notifications-list"
import { SignInRequired } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"

export default function NotificationsPage() {
  const { user } = useSession()
  const { t } = useI18n()

  return (
    <div className="space-y-5">
      <PageHeader icon={Bell} title={t("notif.title")} description={t("notif.subtitle")} />

      {!user ? (
        <SignInRequired description={t("notif.signInRequired")} />
      ) : (
        <NotificationsList />
      )}
    </div>
  )
}
