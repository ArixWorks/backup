import "server-only"
import { cache } from "@/lib/redis"

/** Pending multi-step conversation flows keyed by chat id. */
export type PendingAction =
  | { kind: "awaiting_deposit_amount" }
  | { kind: "awaiting_withdraw_amount" }
  | { kind: "awaiting_quantity"; productId: string }

const TTL = 600 // 10 min
const key = (chatId: string | number) => `tgstate:${chatId}`

export async function setPending(chatId: string | number, action: PendingAction) {
  await cache.set(key(chatId), JSON.stringify(action), TTL)
}

export async function getPending(chatId: string | number): Promise<PendingAction | null> {
  const raw = await cache.get(key(chatId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as PendingAction
  } catch {
    return null
  }
}

export async function clearPending(chatId: string | number) {
  await cache.del(key(chatId))
}
