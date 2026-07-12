import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { telegramContentSchema, webContentSchema } from "@/lib/broadcast/core"
import { createNotification } from "@/lib/core/notifications"
import { sendBroadcastPayload } from "@/lib/telegram/broadcast"

const schema = z.object({
  channels: z.array(z.enum(["TELEGRAM", "WEB"])),
  telegramContent: telegramContentSchema.optional(),
  webContent: webContentSchema.optional(),
})

export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const body = schema.parse(await req.json())
  if (body.channels.includes("TELEGRAM") && body.telegramContent) {
    if (!admin.telegramChatId) throw new Error("حساب مدیر شناسه چت تلگرام ندارد")
    await sendBroadcastPayload(admin.telegramChatId, body.telegramContent)
  }
  if (body.channels.includes("WEB") && body.webContent) {
    await createNotification({ userId: admin.id, type: "GENERAL", ...body.webContent })
  }
  return { delivered: true }
})
