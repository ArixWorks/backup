import "server-only"
import { prisma } from "@/lib/db"
import { DEFAULT_CONFIG, type BotConfig } from "./config"

const SETTING_KEY = "bot_config"
const CACHE_TTL_MS = 10_000

let cache: { value: BotConfig; at: number } | null = null

/** Deep-merge a partial override onto the defaults (one level deep per group). */
function mergeConfig(override: Partial<BotConfig> | null): BotConfig {
  if (!override) return DEFAULT_CONFIG
  return {
    botName: override.botName ?? DEFAULT_CONFIG.botName,
    brandName: override.brandName ?? DEFAULT_CONFIG.brandName,
    emoji: { ...DEFAULT_CONFIG.emoji, ...(override.emoji ?? {}) },
    customEmoji: { ...DEFAULT_CONFIG.customEmoji, ...(override.customEmoji ?? {}) },
    texts: { ...DEFAULT_CONFIG.texts, ...(override.texts ?? {}) },
    buttons: { ...DEFAULT_CONFIG.buttons, ...(override.buttons ?? {}) },
    buttonStyles: { ...DEFAULT_CONFIG.buttonStyles, ...(override.buttonStyles ?? {}) },
    buttonEmoji: { ...DEFAULT_CONFIG.buttonEmoji, ...(override.buttonEmoji ?? {}) },
    buttonEmojiAll: override.buttonEmojiAll ?? DEFAULT_CONFIG.buttonEmojiAll,
    defaultLocale: override.defaultLocale ?? DEFAULT_CONFIG.defaultLocale,
    usdRate: override.usdRate ?? DEFAULT_CONFIG.usdRate,
    channelId: override.channelId ?? DEFAULT_CONFIG.channelId,
    requiredChannels: override.requiredChannels ?? DEFAULT_CONFIG.requiredChannels,
    botUsername: override.botUsername ?? DEFAULT_CONFIG.botUsername,
    gateways: { ...DEFAULT_CONFIG.gateways, ...(override.gateways ?? {}) },
    features: { ...DEFAULT_CONFIG.features, ...(override.features ?? {}) },
  }
}

/** Load the merged, effective bot config (cached briefly). */
export async function getBotConfig(force = false): Promise<BotConfig> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value
  const row = await prisma.botSetting.findUnique({ where: { key: SETTING_KEY } })
  let override: Partial<BotConfig> | null = null
  if (row) {
    try {
      override = JSON.parse(row.value) as Partial<BotConfig>
    } catch {
      override = null
    }
  }
  const merged = mergeConfig(override)
  cache = { value: merged, at: Date.now() }
  return merged
}

/** Persist a new (partial) config override and bust the cache. */
export async function saveBotConfig(override: Partial<BotConfig>): Promise<BotConfig> {
  await prisma.botSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(override) },
    update: { value: JSON.stringify(override) },
  })
  cache = null
  return getBotConfig(true)
}

/** Read the raw stored override (defaults shown when nothing saved yet). */
export async function getStoredOverride(): Promise<BotConfig> {
  return getBotConfig(true)
}
