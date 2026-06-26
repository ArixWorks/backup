import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/session"
import { sendChannelPost, type ChannelPostInput } from "@/lib/core/channel"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ ok: false, error: "admin required" }, { status: 403 })
  }

  let body: ChannelPostInput
  try {
    body = (await req.json()) as ChannelPostInput
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 })
  }

  if (!body.caption?.trim()) {
    return NextResponse.json({ ok: false, error: "caption required" }, { status: 400 })
  }

  try {
    const { messageId } = await sendChannelPost(body)
    return NextResponse.json({ ok: true, data: { messageId } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 })
  }
}
