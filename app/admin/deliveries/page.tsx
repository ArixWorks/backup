import { redirect } from "next/navigation"

/**
 * The standalone manual-delivery surface has been merged into the unified order
 * console at /admin/orders/manage (list + per-order detail with the delivery
 * form). Giveaway-prize delivery continues to live in the giveaway panel.
 * This permanent redirect keeps old bookmarks and in-app links working.
 */
export default function DeliveriesRedirectPage() {
  redirect("/admin/orders/manage")
}
