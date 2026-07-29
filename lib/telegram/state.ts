import "server-only"
import { prisma } from "@/lib/db"

/**
 * Durable KV backing for the bot's conversation state.
 *
 * The Telegram webhook runs on serverless (Vercel), so the callback that arms a
 * prompt and the follow-up message that answers it may execute on DIFFERENT
 * instances. Process memory (the in-memory cache fallback used when REDIS_URL is
 * unset) therefore cannot carry state between them, which silently broke every
 * multi-step flow (deposit reject reason, bid, support, coupon…). Persisting to
 * Postgres makes the state instance-independent and reliable everywhere.
 *
 * Redis-like semantics: `expiresAt` is a TTL; expired rows read as absent and
 * are lazily swept. All writes are best-effort/guarded so a state hiccup can
 * never throw inside a webhook handler.
 */
async function kvSet(key: string, value: string, ttlSeconds: number) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
  await prisma.botKV.upsert({
    where: { key },
    create: { key, value, expiresAt },
    update: { value, expiresAt },
  })
}

async function kvGet(key: string): Promise<string | null> {
  const row = await prisma.botKV.findUnique({ where: { key } })
  if (!row) return null
  if (row.expiresAt.getTime() <= Date.now()) {
    // Lazily drop the expired row; ignore races where it's already gone.
    await prisma.botKV.deleteMany({ where: { key } }).catch(() => {})
    return null
  }
  return row.value
}

async function kvDel(key: string) {
  await prisma.botKV.deleteMany({ where: { key } }).catch(() => {})
}

/**
 * Deposit / payment methods available in the bot. Mirrors the web app payment
 * config (CARD/TON/USDT/STARS) so the two surfaces stay in sync.
 */
export type BotPayMethod = "CARD" | "TON" | "USDT" | "STARS"

/**
 * Pending multi-step conversation flows keyed by chat id. Each record may carry
 * `canvasMessageId` so a text/photo reply can edit the shared canvas in place
 * instead of spamming a new message.
 */
export type PendingAction =
  | { kind: "awaiting_deposit_amount"; method: BotPayMethod; canvasMessageId?: number }
  | { kind: "awaiting_withdraw_amount"; note?: string; canvasMessageId?: number }
  | { kind: "awaiting_quantity"; productId: string; canvasMessageId?: number; couponCode?: string }
  | { kind: "awaiting_bid_amount"; auctionId: string; canvasMessageId?: number }
  | { kind: "awaiting_coupon_code"; productId?: string; canvasMessageId?: number }
  | { kind: "awaiting_support_subject"; category?: string; canvasMessageId?: number }
  | { kind: "awaiting_support_message"; category?: string; subject: string; canvasMessageId?: number }
  | { kind: "awaiting_ticket_reply"; ticketId: string; canvasMessageId?: number }
  | { kind: "awaiting_deposit_receipt"; depositId: string; canvasMessageId?: number }
  | { kind: "awaiting_deposit_reject_reason"; depositId: string; messageId?: number; canvasMessageId?: number }
  | { kind: "awaiting_ban_appeal"; canvasMessageId?: number }

const TTL = 600 // 10 min
const key = (chatId: string | number) => `tgstate:${chatId}`

/**
 * The single editable "canvas" message for a chat: its message id and the photo
 * URL currently shown on it. Navigation edits this message in place (caption
 * swap when the photo is unchanged, media swap when moving to an item cover)
 * instead of sending a new message per view.
 */
export type CanvasState = { id: number; photo: string }
const canvasKey = (chatId: string | number) => `tgcanvas:${chatId}`
const CANVAS_TTL = 86_400 // 24h

export async function setCanvas(chatId: string | number, id: number, photo: string) {
  await kvSet(canvasKey(chatId), JSON.stringify({ id, photo }), CANVAS_TTL)
}

export async function getCanvas(chatId: string | number): Promise<CanvasState | null> {
  const raw = await kvGet(canvasKey(chatId))
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as CanvasState
    return Number.isFinite(v.id) ? v : null
  } catch {
    return null
  }
}

export async function setPending(chatId: string | number, action: PendingAction) {
  await kvSet(key(chatId), JSON.stringify(action), TTL)
}

export async function getPending(chatId: string | number): Promise<PendingAction | null> {
  const raw = await kvGet(key(chatId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as PendingAction
  } catch {
    return null
  }
}

export async function clearPending(chatId: string | number) {
  await kvDel(key(chatId))
}

/**
 * A short-lived pending flash-sale order (product + quantity + optional coupon)
 * kept between the quantity/coupon step and the payment-method choice, so the
 * pay buttons stay short (`opay:<method>`) and can carry a coupon code that
 * would be unsafe to encode in callback data.
 */
export type OrderDraft = { productId: string; qty: number; couponCode?: string }
const draftKey = (chatId: string | number) => `tgdraft:${chatId}`

export async function setOrderDraft(chatId: string | number, draft: OrderDraft) {
  await kvSet(draftKey(chatId), JSON.stringify(draft), TTL)
}

export async function getOrderDraft(chatId: string | number): Promise<OrderDraft | null> {
  const raw = await kvGet(draftKey(chatId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as OrderDraft
  } catch {
    return null
  }
}

export async function clearOrderDraft(chatId: string | number) {
  await kvDel(draftKey(chatId))
}
