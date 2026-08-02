import { redirect } from "next/navigation"

// Consolidated into the unified settings hub (Email tab).
export default function AdminEmailPage() {
  redirect("/admin/settings?tab=email")
}
