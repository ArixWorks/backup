import assert from "node:assert/strict"
import test from "node:test"
import { NotificationType, WalletTxType } from "@prisma/client"
import { z } from "zod"

const notificationQuerySchema = z.object({
  unread: z.enum(["0", "1"]).default("0"),
  archived: z.enum(["0", "1"]).default("0"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  type: z.nativeEnum(NotificationType).optional(),
  q: z.string().trim().max(200).optional(),
})

const statementQuerySchema = z.object({
  currency: z.string().trim().min(1).max(16).default("IRT"),
  type: z.nativeEnum(WalletTxType).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  q: z.string().trim().max(200).optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).max(100_000).default(0),
}).refine((value) => !value.from || !value.to || value.from <= value.to)

test("notification pagination accepts safe values and rejects invalid values", () => {
  assert.equal(notificationQuerySchema.parse({ limit: "100" }).limit, 100)
  assert.equal(notificationQuerySchema.safeParse({ limit: "-1" }).success, false)
  assert.equal(notificationQuerySchema.safeParse({ limit: "NaN" }).success, false)
  assert.equal(notificationQuerySchema.safeParse({ type: "INVALID" }).success, false)
})

test("statement pagination rejects negative and non-numeric offsets", () => {
  assert.equal(statementQuerySchema.parse({ skip: "0", take: "50" }).skip, 0)
  assert.equal(statementQuerySchema.safeParse({ skip: "-1" }).success, false)
  assert.equal(statementQuerySchema.safeParse({ take: "NaN" }).success, false)
})

test("statement filters reject reversed date ranges", () => {
  const result = statementQuerySchema.safeParse({
    from: "2026-07-19T00:00:00.000Z",
    to: "2026-07-18T00:00:00.000Z",
  })
  assert.equal(result.success, false)
})
