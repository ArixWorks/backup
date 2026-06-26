import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getAllSettings, setSettings } from "@/lib/core/settings"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  await requireAdmin()
  return getAllSettings()
})

// Accept a partial map of setting key -> string value.
const schema = z.record(z.string(), z.string())

export const PATCH = route(async (req: Request) => {
  await requireAdmin()
  const body = schema.parse(await req.json())
  await setSettings(body)
  return { ok: true }
})
