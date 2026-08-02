import { redirect } from "next/navigation"

// Consolidated into the unified settings hub (Telegram tab).
export default function ChannelPage() {
  redirect("/admin/settings?tab=telegram")
}
