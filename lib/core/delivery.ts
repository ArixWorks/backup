import type { Prisma } from "@prisma/client"
import { DomainError } from "./errors"
import { inventoryToValues } from "./delivery-fields"

type Tx = Prisma.TransactionClient

export class NoInventoryError extends DomainError {
  constructor(message = "No inventory available for automatic delivery") {
    super(message, "NO_INVENTORY", 409)
  }
}

type InventoryScope = { productId: string; variantId?: string | null }

/**
 * Atomically claim one seat from the inventory pool, filling shared accounts
 * sequentially: the oldest AVAILABLE item is used until its `capacity` seats
 * are exhausted, then the next item is used. capacity=1 behaves exactly like
 * the original single-use claim.
 *
 * Returns the claimed item (with a fresh `seatsUsed`) or null when the pool is
 * exhausted. Race-safe via a conditional updateMany guarded by the observed
 * seatsUsed value; callers should retry a few times on a null-from-contention.
 */
export async function claimInventorySeat(
  db: Tx,
  scope: InventoryScope,
): Promise<InventoryItemRow | null> {
  const where = scope.variantId
    ? { variantId: scope.variantId, status: "AVAILABLE" as const }
    : { productId: scope.productId, status: "AVAILABLE" as const }

  // A few attempts to absorb concurrent seat grabs on the same hot account.
  for (let attempt = 0; attempt < 5; attempt++) {
    const item = await db.inventoryItem.findFirst({
      where,
      orderBy: { createdAt: "asc" },
    })
    if (!item) return null

    const nextSeats = item.seatsUsed + 1
    const willBeFull = nextSeats >= item.capacity

    // Conditional claim: only succeeds if no one else took this exact seat.
    const claimed = await db.inventoryItem.updateMany({
      where: { id: item.id, status: "AVAILABLE", seatsUsed: item.seatsUsed },
      data: {
        seatsUsed: nextSeats,
        reservedAt: item.reservedAt ?? new Date(),
        ...(willBeFull ? { status: "DELIVERED" as const } : {}),
      },
    })
    if (claimed.count === 1) {
      return { ...item, seatsUsed: nextSeats }
    }
    // Lost the race — retry with a fresh read.
  }
  return null
}

type InventoryItemRow = Prisma.InventoryItemGetPayload<Record<string, never>>

/**
 * Claim a single-use inventory item for an order and record a completed
 * delivery. Designed to run inside the SAME transaction as the charge so that
 * if it throws, the whole purchase rolls back automatically (no charge, no
 * stock decrement). Inventory is claimed with a conditional update to prevent
 * two orders from grabbing the same item under concurrency.
 */
export async function reserveAndDeliverAuto(
  orderId: string,
  productId: string,
  db: Tx,
  variantId?: string | null,
): Promise<void> {
  // Scope the inventory pool to the chosen sale plan when the order carries a
  // variant. Legacy single-plan orders (no variantId) fall back to the whole
  // product pool, preserving pre-variants behaviour.
  const [item, product] = await Promise.all([
    claimInventorySeat(db, { productId, variantId }),
    db.product.findUnique({
      where: { id: productId },
      select: { defaultTutorialId: true },
    }),
  ])
  if (!item) throw new NoInventoryError()

  await db.delivery.create({
    data: {
      orderId,
      method: "AUTOMATIC",
      status: "DELIVERED",
      inventoryItemId: item.id,
      tutorialId: product?.defaultTutorialId ?? null,
      deliveredAt: new Date(),
      // Resolve the delivered credentials from the dynamic `fields` map, falling
      // back to the legacy typed columns for pre-migration inventory.
      payload: inventoryToValues(item),
    },
  })

  await db.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } })
}

/** Create a pending manual delivery to be completed by an admin later. */
export async function createManualDelivery(orderId: string, db: Tx): Promise<void> {
  await db.delivery.create({
    data: { orderId, method: "MANUAL", status: "PENDING" },
  })
  await db.order.update({ where: { id: orderId }, data: { status: "PAID" } })
}

/**
 * Count remaining single-use inventory items. Scoped to a sale plan when a
 * variantId is given, otherwise counts the whole product pool (legacy).
 */
export async function availableInventoryCount(
  productId: string,
  db: Tx,
  variantId?: string | null,
): Promise<number> {
  // Count remaining seats across the pool, not just item rows, so a single
  // shared account with capacity 10 reports 10 available slots.
  const items = await db.inventoryItem.findMany({
    where: variantId ? { variantId, status: "AVAILABLE" } : { productId, status: "AVAILABLE" },
    select: { capacity: true, seatsUsed: true },
  })
  return items.reduce((sum, i) => sum + Math.max(0, i.capacity - i.seatsUsed), 0)
}
