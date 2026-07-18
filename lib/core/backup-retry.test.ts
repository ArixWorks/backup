import assert from "node:assert/strict"
import test from "node:test"
import { TimeoutError, withRetry } from "./resilience"

function isRetryableUploadError(err: unknown): boolean {
  if (err instanceof TimeoutError) return true
  const status = (err as { status?: number })?.status
  if (typeof status === "number") return status === 429 || status >= 500
  return err instanceof TypeError
}

function statusError(status: number): Error & { status: number } {
  return Object.assign(new Error(`HTTP ${status}`), { status })
}

test("backup upload retries a timeout and succeeds on the next attempt", async () => {
  let attempts = 0
  const result = await withRetry(
    async () => {
      attempts += 1
      if (attempts === 1) throw new TimeoutError("telegram.sendDocument", 60_000)
      return "sent"
    },
    { attempts: 3, baseDelayMs: 0, maxDelayMs: 0, retryable: isRetryableUploadError },
  )

  assert.equal(result, "sent")
  assert.equal(attempts, 2)
})

test("backup upload retries transient HTTP and network failures", async () => {
  assert.equal(isRetryableUploadError(statusError(429)), true)
  assert.equal(isRetryableUploadError(statusError(500)), true)
  assert.equal(isRetryableUploadError(new TypeError("fetch failed")), true)
})

test("backup upload does not retry permanent Telegram 4xx failures", async () => {
  let attempts = 0
  await assert.rejects(
    withRetry(
      async () => {
        attempts += 1
        throw statusError(400)
      },
      { attempts: 3, baseDelayMs: 0, maxDelayMs: 0, retryable: isRetryableUploadError },
    ),
    /HTTP 400/,
  )
  assert.equal(attempts, 1)
})
