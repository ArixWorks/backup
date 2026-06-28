"use client"

import { Bell } from "lucide-react"
import { NotificationsList } from "@/components/notifications-list"
import { SignInRequired } from "@/components/empty-state"
import { useSession } from "@/hooks/use-session"

export default function NotificationsPage() {
  const { user } = useSession()

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <Bell className="h-5 w-5 text-primary" />
          اعلان‌ها
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          آخرین رویدادهای حساب شما: موجودی محصولات، سفارش‌ها، مزایده‌ها و تراکنش‌ها.
        </p>
      </header>

      {!user ? (
        <SignInRequired description="برای مشاهده اعلان‌ها، ابتدا وارد حساب کاربری خود شوید." />
      ) : (
        <NotificationsList />
      )}
    </div>
  )
}
