import { NextResponse } from "next/server"
import { getBotConfig, saveBotConfig } from "@/lib/telegram/settings"
import { botConfigured, getMe } from "@/lib/telegram/api"

export const dynamic = "force-dynamic"

/** Public, non-sensitive config the web app needs for i18n + price display. */
export async function GET() {
  const cfg = await getBotConfig()

  // Resolve the bot username automatically once a token is set, so the
  // Telegram Login Widget activates without a manual admin step. Cached after
  // the first successful lookup.
  let botUsername = cfg.botUsername
  if (!botUsername && botConfigured()) {
    const me = (await getMe().catch(() => null)) as { username?: string } | null
    if (me?.username) {
      botUsername = me.username
      await saveBotConfig({ botUsername }).catch(() => {})
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      defaultLocale: cfg.defaultLocale,
      usdRate: cfg.usdRate,
      brandName: cfg.brandName,
      // Used by the Telegram Login Widget on the web login page.
      botUsername,
    },
  })
}
