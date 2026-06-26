import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/session"
import { getStoredOverride, saveBotConfig } from "@/lib/telegram/settings"
import { DEFAULT_CONFIG, type BotConfig } from "@/lib/telegram/config"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function guard() {
  try {
    await requireAdmin()
    return null
  } catch {
    return NextResponse.json({ ok: false, error: "admin required" }, { status: 403 })
  }
}

export async function GET() {
  const denied = await guard()
  if (denied) return denied
  const config = await getStoredOverride()
  return NextResponse.json({ ok: true, data: { config, defaults: DEFAULT_CONFIG } })
}

export async function PUT(req: Request) {
  const denied = await guard()
  if (denied) return denied
  const body = (await req.json()) as Partial<BotConfig>
  const config = await saveBotConfig(body)
  return NextResponse.json({ ok: true, data: { config } })
}
