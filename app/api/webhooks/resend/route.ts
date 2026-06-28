import { NextResponse } from "next/server"
import { Webhook } from "svix"
import { applyProviderEvent, type ProviderWebhookEvent } from "@/lib/email/events"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Resend delivery webhook. Resend signs events with Svix, so we MUST verify
 * against the raw request body using the svix-* headers. Configure the endpoint
 * URL (this route) and signing secret in the Resend dashboard, and set
 * RESEND_WEBHOOK_SECRET in the environment.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  const raw = await req.text()

  let event: ProviderWebhookEvent
  if (secret) {
    const headers = {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    }
    try {
      event = new Webhook(secret).verify(raw, headers) as ProviderWebhookEvent
    } catch (err) {
      console.log("[v0] resend webhook signature invalid:", (err as Error).message)
      return NextResponse.json({ error: "invalid signature" }, { status: 401 })
    }
  } else {
    // No secret configured: accept but log (useful in early setup). Strongly
    // recommend setting RESEND_WEBHOOK_SECRET before production.
    console.log("[v0] RESEND_WEBHOOK_SECRET not set — accepting webhook unverified")
    try {
      event = JSON.parse(raw) as ProviderWebhookEvent
    } catch {
      return NextResponse.json({ error: "bad payload" }, { status: 400 })
    }
  }

  try {
    const res = await applyProviderEvent(event)
    return NextResponse.json({ ok: true, matched: res.matched })
  } catch (err) {
    console.log("[v0] resend webhook apply error:", (err as Error).message)
    // Return 200 so Resend doesn't hammer retries on our own processing bug;
    // the raw event is already logged for reconciliation.
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
