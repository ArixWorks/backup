import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getSetting, setSettings, SETTING_KEYS } from "@/lib/core/settings"

export const dynamic = "force-dynamic"

/** Read the daily-backup configuration. */
export const GET = route(async () => {
  await requireAdmin()
  return {
    enabled: (await getSetting(SETTING_KEYS.backupEnabled)) === "true",
    chatId: await getSetting(SETTING_KEYS.backupChatId),
    hour: Number(await getSetting(SETTING_KEYS.backupHour)) || 0,
    lastRunDate: await getSetting(SETTING_KEYS.backupLastRunDate),
  }
})

const schema = z.object({
  enabled: z.boolean().optional(),
  // Telegram chat ids are numeric (can be negative for groups); allow blank.
  chatId: z
    .string()
    .trim()
    .regex(/^-?\d*$/, "شناسه چت باید عددی باشد")
    .optional(),
  hour: z.number().int().min(0).max(23).optional(),
})

/** Update the daily-backup configuration. */
export const PATCH = route(async (req: Request) => {
  await requireAdmin()
  const body = schema.parse(await req.json())

  const entries: Record<string, string> = {}
  if (body.enabled !== undefined) entries[SETTING_KEYS.backupEnabled] = body.enabled ? "true" : "false"
  if (body.chatId !== undefined) entries[SETTING_KEYS.backupChatId] = body.chatId
  if (body.hour !== undefined) entries[SETTING_KEYS.backupHour] = String(body.hour)
  if (Object.keys(entries).length) await setSettings(entries)

  return { ok: true }
})
