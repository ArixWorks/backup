import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { deposit } from "@/lib/core/wallet"
import { rateLimitBy } from "@/lib/api/rate-limit"
import { withIdempotency, idempotencyKey, readIdempotencyHeader } from "@/lib/api/idempotency"

// Demo top-up. In production, a deposit becomes a Pending request approved by
// an admin (card-to-card flow). The wallet credit logic itself is identical.
const schema = z.object({ amount: z.union([z.string(), z.number()]) })

export const POST = route(async (req: Request) => {
  const user = await requireUser()
  const header = readIdempotencyHeader(req)
  const body = schema.parse(await req.json())
  const amount = BigInt(body.amount)
  if (amount <= 0n) throw new Error("Amount must be positive")
  // Cap top-ups per user, and make each one idempotent so a retry/double-click
  // never credits the wallet twice.
  await rateLimitBy(user.id, { bucket: "wallet:topup", limit: 20, windowSec: 3600 })
  return withIdempotency(
    { key: idempotencyKey({ userId: user.id, operation: "wallet:topup", header, payload: body }) },
    () => prisma.$transaction((tx) => deposit(user.id, amount, tx, { type: "manual-topup", id: user.id })),
  )
})
