import { redirect } from "next/navigation"

// Consolidated into the unified settings hub (System tab).
export default function TwoFactorRequestsPage() {
  redirect("/admin/settings?tab=system")
}
