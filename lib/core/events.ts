import { cache } from "@/lib/redis"
import { serialize } from "@/lib/serialize"

/**
 * Domain events are published to Redis pub/sub channels. In production a
 * WebSocket gateway / Telegram bot subscribes to these. In the preview the
 * publish is a no-op and clients fall back to polling.
 */
export const Channels = {
  auction: (auctionId: string) => `auction:${auctionId}`,
  notifications: (userId: string) => `notify:${userId}`,
  broadcast: "broadcast",
} as const

export type DomainEvent =
  | { type: "BID_PLACED"; auctionId: string; amount: string; bidderAlias: string; endTime: string }
  | { type: "AUCTION_EXTENDED"; auctionId: string; endTime: string }
  | { type: "AUCTION_FINALIZED"; auctionId: string }
  | { type: "AUCTION_STARTED"; auctionId: string; watchers: number }
  | { type: "BUY_NOW"; auctionId: string }
  | { type: "STOCK_CHANGED"; productId: string; stock: number }
  | { type: "NOTIFY"; userId: string; title: string; body: string }

export async function emit(channel: string, event: DomainEvent): Promise<void> {
  try {
    await cache.publish(channel, JSON.stringify(serialize(event)))
  } catch {
    // Never let realtime delivery break a transaction's success.
  }
}
