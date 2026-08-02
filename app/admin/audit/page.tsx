import { redirect } from "next/navigation"

// Consolidated into the unified settings hub (System tab).
export default function AdminAuditPage() {
  redirect("/admin/settings?tab=system")
}
