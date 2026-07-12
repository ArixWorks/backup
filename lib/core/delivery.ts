import type { Prisma } from "@prisma/client"
import { ConflictError, DomainError } from "./errors"

type Tx = Prisma.TransactionClient

export class NoInventoryError extends DomainError {
  constructor(message = "No inventory available for automatic delivery") {
    super(message, "NO_INVENTORY", 409)
  }
}

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
  const item = await db.inventoryItem.findFirst({
    where: variantId
      ? { variantId, status: "AVAILABLE" }
      : { productId, status: "AVAILABLE" },
    orderBy: { createdAt: "asc" },
  })
  if (!item) throw new NoInventoryError()

  // Atomic claim: only succeeds if the item is still AVAILABLE.
  const claimed = await db.inventoryItem.updateMany({
    where: { id: item.id, status: "AVAILABLE" },
    data: { status: "DELIVERED", reservedAt: new Date() },
  })
  if (claimed.count !== 1) {
    throw new ConflictError("Inventory item was claimed concurrently")
  }

  await db.delivery.create({
    data: {
      orderId,
      method: "AUTOMATIC",
      status: "DELIVERED",
      inventoryItemId: item.id,
      deliveredAt: new Date(),
      payload: {
        username: item.username,
        password: item.password,
        licenseKey: item.licenseKey,
        note: item.note,
      },
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
  return db.inventoryItem.count({
    where: variantId ? { variantId, status: "AVAILABLE" } : { productId, status: "AVAILABLE" },
  })
}
