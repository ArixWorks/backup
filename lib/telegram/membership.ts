import "server-only"
import { getChatMember } from "./api"
import { cache } from "@/lib/redis"
import type { BotConfig, RequiredChannel } from "./config"

/**
 * Forced-join membership checks. A user must be a member of every configured
 * required channel before they can use the bot. To avoid hammering the
 * Telegram API on every interaction we cache a positive ("ok") result briefly;
 * the cache is busted whenever the user taps "verify" so re-joins are detected
 * immediately.
 */

const PASS_TTL = 90 // seconds a "passed" result stays cached
const passKey = (id: number | string) => `tgjoin:${id}`

/** Statuses that count as an active member of the channel. */
const JOINED = new Set(["creator", "administrator", "member"])

export type MembershipResult = { ok: boolean; missing: RequiredChannel[] }

/** Only the channels that are valid AND forced-join is enabled. */
function activeChannels(cfg: BotConfig): RequiredChannel[] {
  if (!cfg.features.forcedJoin) return []
  return (cfg.requiredChannels ?? []).filter((ch) => ch && ch.id && ch.id.trim())
}

/** Whether forced join is configured at all (used to short-circuit callers). */
export function forcedJoinActive(cfg: BotConfig): boolean {
  return activeChannels(cfg).length > 0
}

/**
 * Check the user's membership across all required channels.
 * - Reads a short-lived positive cache unless `force` is set.
 * - Channels the bot can't read (not admin / invalid id) are skipped so a
 *   misconfiguration never locks every user out — it just isn't enforced.
 */
export async function checkMemberships(
  cfg: BotConfig,
  telegramId: number | string,
  opts: { force?: boolean } = {},
): Promise<MembershipResult> {
  const channels = activeChannels(cfg)
  if (channels.length === 0) return { ok: true, missing: [] }

  if (!opts.force) {
    const cached = await cache.get(passKey(telegramId))
    if (cached === "ok") return { ok: true, missing: [] }
  }

  const missing: RequiredChannel[] = []
  for (const ch of channels) {
    try {
      const res = await getChatMember(ch.id.trim(), telegramId)
      const status = res?.status ?? "left"
      const isMember = JOINED.has(status) || (status === "restricted" && res.is_member === true)
      if (!isMember) missing.push(ch)
    } catch (e) {
      console.log("[v0] forced-join getChatMember failed for", ch.id, (e as Error).message)
    }
  }

  if (missing.length === 0) {
    await cache.set(passKey(telegramId), "ok", PASS_TTL)
    return { ok: true, missing: [] }
  }
  return { ok: false, missing }
}

export type SingleChannelResult = {
  /** Whether the user is considered joined to this channel. */
  joined: boolean
  /**
   * Whether the bot could ACTUALLY verify membership (it is an admin of the
   * channel and Telegram returned a real status). When false, `joined` is an
   * optimistic pass because the bot cannot read membership and therefore cannot
   * enforce it — matching the bulk check, which skips unreadable channels.
   */
  verifiable: boolean
}

/**
 * Check membership for a SINGLE required channel — used by the join gate to put
 * a green tick on the specific channel a user just visited, the moment they
 * return to the app.
 *
 * Semantics requested by product:
 *  - If the bot is an admin of that channel → do a REAL getChatMember check and
 *    report the true joined/not-joined status (`verifiable: true`).
 *  - If the bot is NOT an admin (Telegram errors / can't read) → it cannot
 *    enforce membership anyway, so optimistically pass (`verifiable: false`).
 */
export async function checkSingleChannel(
  cfg: BotConfig,
  telegramId: number | string,
  channelId: string,
): Promise<SingleChannelResult> {
  const ch = activeChannels(cfg).find((c) => c.id.trim() === channelId.trim())
  // Unknown / not-enforced channel → nothing to enforce, treat as passed.
  if (!ch) return { joined: true, verifiable: false }

  try {
    const res = await getChatMember(ch.id.trim(), telegramId)
    const status = res?.status ?? "left"
    const isMember = JOINED.has(status) || (status === "restricted" && res.is_member === true)
    return { joined: isMember, verifiable: true }
  } catch (e) {
    // Bot isn't admin / can't read this channel → can't enforce, optimistic pass.
    console.log("[v0] single-channel getChatMember failed for", channelId, (e as Error).message)
    return { joined: true, verifiable: false }
  }
}

/** Drop the cached "passed" flag so the next check re-queries Telegram. */
export async function clearMembershipCache(telegramId: number | string) {
  await cache.del(passKey(telegramId))
}
