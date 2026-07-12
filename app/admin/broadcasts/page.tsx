import type { Metadata } from "next"
import { BroadcastCenter } from "@/components/admin/broadcast-center"

export const metadata: Metadata = {
  title: "مرکز پیام | پنل مدیریت",
  description: "ارسال و مدیریت پیام‌های تلگرام و اعلان‌های وب‌اپ",
}

export default function BroadcastsPage() {
  return <BroadcastCenter />
}
