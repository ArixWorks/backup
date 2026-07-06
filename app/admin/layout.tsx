import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AdminShell } from "@/components/admin/admin-shell"
import { getCurrentUser } from "@/lib/auth/session"
import { isBootstrapAdminTelegramId } from "@/lib/telegram/user"

export const metadata: Metadata = {
  title: "پنل مدیریت | SubIO",
}

// The admin subtree is data-driven entirely by client-side calls to
// /api/v1/admin/* (each protected by requireAdmin). Without a matching guard on
// the pages themselves, a non-admin (or logged-out) visitor would see the full
// admin chrome while every list silently 403s and renders as "empty". Guard the
// whole subtree server-side so only real admins ever reach it; everyone else is
// sent to login. This closes the access gap AND removes the confusing empty-panel
// failure mode.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const isAdmin =
    !!user && (user.role === "ADMIN" || isBootstrapAdminTelegramId(user.telegramId))
  if (!isAdmin) redirect("/login?next=/admin")

  // `admin-scope` pins a permanent Premium Dark + Gold identity for the whole
  // admin subtree, independent of the app theme or the admin's membership tier.
  return (
    <div className="admin-scope min-h-dvh">
      <AdminShell>{children}</AdminShell>
    </div>
  )
}
