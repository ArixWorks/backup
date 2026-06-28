import "server-only"
import { Resend } from "resend"
import { withTimeout, TimeoutError } from "@/lib/core/resilience"

/**
 * Low-level provider transport. This performs a SINGLE delivery attempt and
 * either returns the provider message id or throws a classified
 * `EmailDeliveryError`. Retries/backoff are the worker's responsibility, not
 * this layer's — keeping the transport a thin, testable boundary over Resend.
 */

export class EmailDeliveryError extends Error {
  /** HTTP-ish status from the provider (0 = network/timeout). */
  status: number
  /** True when retrying cannot help (invalid address, 4xx validation, …). */
  permanent: boolean
  constructor(message: string, status: number, permanent: boolean) {
    super(message)
    this.name = "EmailDeliveryError"
    this.status = status
    this.permanent = permanent
  }
}

export interface DeliverInput {
  from: string
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  headers?: Record<string, string>
  tags?: { name: string; value: string }[]
}

export interface DeliverResult {
  providerId: string | null
  /** True when no provider is configured and the send was logged, not sent. */
  skipped?: boolean
}

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY
  return key ? new Resend(key) : null
}

/** Transient = worth retrying: timeouts, network errors, 5xx, 408, 429. */
function isTransient(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500
}

export async function deliverNow(input: DeliverInput): Promise<DeliverResult> {
  const resend = client()
  if (!resend) {
    // No key (local/dev): log a preview instead of throwing so flows keep working.
    console.log("[v0] RESEND_API_KEY missing — email not sent. Preview:", {
      to: input.to,
      subject: input.subject,
    })
    return { providerId: null, skipped: true }
  }

  const { data, error } = await withTimeout(
    15_000,
    () =>
      resend.emails.send({
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
        headers: input.headers,
        tags: input.tags,
      }),
    "resend.send",
  ).catch((err) => {
    if (err instanceof TimeoutError) {
      throw new EmailDeliveryError(err.message, 0, false)
    }
    // Unknown network-level failure — treat as transient.
    throw new EmailDeliveryError((err as Error).message || "network error", 0, false)
  })

  if (error) {
    const status = (error as { statusCode?: number }).statusCode ?? 0
    // 4xx (except 408/429) are permanent: invalid recipient, validation, etc.
    const permanent = status >= 400 && status < 500 && !isTransient(status)
    throw new EmailDeliveryError(error.message || "Resend error", status, permanent)
  }

  return { providerId: data?.id ?? null }
}
