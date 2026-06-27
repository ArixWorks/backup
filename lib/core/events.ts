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
  /** Operations Center realtime stream (metrics, health, alerts, activity). */
  ops: "ops:events",
} as const

/**
 * Realtime events for the Operations Center. Consumed by the SSE/WebSocket
 * gateway and pushed to the admin dashboard. Kept flexible (string `kind`) so
 * new event types can be added without churning the domain event union.
 */
export type OpsEvent = {
  kind:
    | "metrics"
    | "health"
    | "alert"
    | "alert_resolved"
    | "activity"
    | "error"
    | "heartbeat"
  at: string
  payload: Record<string, unknown>
}

export async function emitOps(event: Omit<OpsEvent, "at">): Promise<void> {
  try {
    const full: OpsEvent = { ...event, at: new Date().toISOString() }
    await cache.publish(Channels.ops, JSON.stringify(serialize(full)))
  } catch {
    // Realtime delivery is best-effort; never block the caller.
  }
}

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
