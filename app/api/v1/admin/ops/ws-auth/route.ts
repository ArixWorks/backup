import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Lightweight admin auth check used by the standalone WebSocket server to
 * authorize an upgrade request. The WS server forwards the incoming Cookie
 * header here; a 200 means the session belongs to an admin. Keeping this here
 * means the WS process never needs to duplicate session crypto.
 */
export async function GET() {
  try {
    const user = await requireAdmin()
    return NextResponse.json({ ok: true, userId: user.id })
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
}
