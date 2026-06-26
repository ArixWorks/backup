import type { Metadata } from "next"
import { ChannelComposer } from "@/components/admin/channel-composer"

export const metadata: Metadata = {
  title: "پست کانال | پنل مدیریت",
}

export default function ChannelPage() {
  return <ChannelComposer />
}
