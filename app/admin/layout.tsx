import type { Metadata } from "next"
import { AdminShell } from "@/components/admin/admin-shell"

export const metadata: Metadata = {
  title: "پنل مدیریت | SubIO",
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // `admin-scope` pins a permanent Premium Dark + Gold identity for the whole
  // admin subtree, independent of the app theme or the admin's membership tier.
  return (
    <div className="admin-scope min-h-dvh">
      <AdminShell>{children}</AdminShell>
    </div>
  )
}
