import "server-only"
import { prisma } from "@/lib/db"

/**
 * Admin KPI snapshot for the VPS section. `pendingOrders` drives the sidebar
 * badge (orders awaiting an admin action) and `openRequests` the service-queue
 * badge. Everything here is admin-only.
 */
export async function getVpsOverview() {
  const [
    totalOffers,
    activeOffers,
    pendingOrders,
    processingOrders,
    readyOrders,
    completedOrders,
    activeInstances,
    openRequests,
  ] = await Promise.all([
    prisma.vpsOffer.count(),
    prisma.vpsOffer.count({ where: { active: true } }),
    prisma.vpsOrder.count({ where: { status: "PENDING_PURCHASE" } }),
    prisma.vpsOrder.count({ where: { status: "PROCESSING" } }),
    prisma.vpsOrder.count({ where: { status: "READY_FOR_DELIVERY" } }),
    prisma.vpsOrder.count({ where: { status: "COMPLETED" } }),
    prisma.vpsInstance.count({ where: { status: "ACTIVE" } }),
    prisma.vpsServiceRequest.count({ where: { status: { in: ["OPEN", "PROCESSING"] } } }),
  ])

  return {
    totalOffers,
    activeOffers,
    pendingOrders,
    processingOrders,
    readyOrders,
    completedOrders,
    activeInstances,
    openRequests,
    // Convenience total for the sidebar badge: everything needing an admin touch.
    actionable: pendingOrders + processingOrders + readyOrders + openRequests,
  }
}
