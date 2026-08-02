-- Additive DDL for the multi-step order fulfillment (roadmap) feature.
-- Idempotent so it can be re-run safely and sidesteps unrelated index drift
-- that could block a full `prisma db push`.
--
-- IMPORTANT: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction and a
-- newly added enum value cannot be referenced in the same transaction. Run
-- this file with autocommit (psql default), not wrapped in BEGIN/COMMIT.

-- New OrderStatus values (append-only; guarded — no IF NOT EXISTS pre-PG12,
-- but Neon is PG16 so IF NOT EXISTS is supported).
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'AWAITING_CUSTOMER_INPUT';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'AWAITING_EXTENSION_APPROVAL';

-- Order lifecycle columns (all nullable/defaulted — safe on existing rows).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "requiresCustomerInput" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerInputFields" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerInput" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerInputAt" timestamp(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "processingStartedAt" timestamp(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "dueAt" timestamp(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "extensionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pendingExtensionMinutes" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "extensionRequestedAt" timestamp(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "overdueNotifiedAt" timestamp(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "completionNote" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "completionTutorialId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelReasonCode" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundedAmount" BIGINT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isGiveawayPrize" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "giveawayId" TEXT;

-- FKs for the two new Order relations (guarded; Postgres has no IF NOT EXISTS
-- for ADD CONSTRAINT, so check the catalog first).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_completionTutorialId_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_completionTutorialId_fkey"
      FOREIGN KEY ("completionTutorialId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_giveawayId_fkey') THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_giveawayId_fkey"
      FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "Order_status_dueAt_idx" ON "Order" ("status", "dueAt");
CREATE INDEX IF NOT EXISTS "Order_userId_type_createdAt_idx" ON "Order" ("userId", "type", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_completionTutorialId_idx" ON "Order" ("completionTutorialId");
CREATE INDEX IF NOT EXISTS "Order_giveawayId_idx" ON "Order" ("giveawayId");

-- OrderEvent lifecycle log table.
CREATE TABLE IF NOT EXISTS "OrderEvent" (
  "id"             TEXT PRIMARY KEY,
  "orderId"        TEXT NOT NULL,
  "type"           TEXT NOT NULL,
  "fromStatus"     "OrderStatus",
  "toStatus"       "OrderStatus",
  "actorType"      TEXT NOT NULL,
  "actorId"        TEXT,
  "reasonCode"     TEXT,
  "message"        TEXT,
  "meta"           JSONB NOT NULL DEFAULT '{}',
  "idempotencyKey" TEXT NOT NULL,
  "createdAt"      timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderEvent_orderId_fkey') THEN
    ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "OrderEvent_idempotencyKey_key" ON "OrderEvent" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "OrderEvent_orderId_createdAt_idx" ON "OrderEvent" ("orderId", "createdAt");

-- Product customer-input columns.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "requiresCustomerInput" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "customerInputFields" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "avgCompletionMinutes" INTEGER;

-- ProductVariant overrides (nullable — "unset" is distinct from "false").
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "requiresCustomerInput" BOOLEAN;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "customerInputFields" JSONB;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "avgCompletionMinutes" INTEGER;
