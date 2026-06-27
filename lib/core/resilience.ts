import "server-only"

/**
 * Reusable resilience primitives for hardening calls to anything that can fail
 * or hang: external HTTP APIs (Telegram, Resend), Redis, and other I/O.
 *
 * Three composable tools:
 *   - withTimeout: bound how long a promise may run (defends against hangs /
 *     network latency / a dependency that never responds).
 *   - withRetry:   retry transient failures with exponential backoff + jitter.
 *   - CircuitBreaker: stop hammering a dependency that is clearly down; fail
 *     fast (or fall back) until a cool-down has elapsed, then probe once.
 *
 * Everything is dependency-free and safe to use in serverless and long-running
 * (worker) runtimes alike.
 */

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`)
    this.name = "TimeoutError"
  }
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit "${name}" is open`)
    this.name = "CircuitOpenError"
  }
}

/**
 * Reject if `fn` does not settle within `ms`. Passes an AbortSignal so callers
 * that support cancellation (e.g. fetch) actually stop the underlying work
 * instead of leaking it.
 */
export async function withTimeout<T>(
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
  label = "operation",
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await Promise.race([
      // Normalize an abort-driven rejection (e.g. fetch's AbortError) into our
      // TimeoutError so callers have a single, reliable signal to retry on.
      fn(controller.signal).catch((err) => {
        if (controller.signal.aborted) throw new TimeoutError(label, ms)
        throw err
      }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new TimeoutError(label, ms)), {
          once: true,
        })
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export interface RetryOptions {
  /** Total attempts including the first. Default 3. */
  attempts?: number
  /** Base backoff in ms (doubles each attempt). Default 200. */
  baseDelayMs?: number
  /** Upper bound on a single backoff delay. Default 4000. */
  maxDelayMs?: number
  /** Return false to stop retrying a given error (e.g. 4xx). Default: retry all. */
  retryable?: (err: unknown) => boolean
  /** Optional per-attempt override (e.g. honor a server Retry-After). */
  delayFor?: (err: unknown, attempt: number) => number | undefined
  /** Called before each retry sleep — useful for logging/metrics. */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Run `fn`, retrying transient failures with exponential backoff + jitter. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3
  const base = opts.baseDelayMs ?? 200
  const max = opts.maxDelayMs ?? 4000
  const retryable = opts.retryable ?? (() => true)

  let lastErr: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt >= attempts || !retryable(err)) throw err
      const override = opts.delayFor?.(err, attempt)
      const backoff = Math.min(max, base * 2 ** (attempt - 1))
      const jitter = Math.floor(Math.random() * (backoff / 2))
      const delay = override ?? backoff + jitter
      opts.onRetry?.(err, attempt, delay)
      await sleep(delay)
    }
  }
  throw lastErr
}

type CircuitState = "closed" | "open" | "half-open"

export interface CircuitOptions {
  /** Consecutive failures that trip the breaker. Default 5. */
  failureThreshold?: number
  /** How long to stay open before probing again (ms). Default 30000. */
  resetTimeoutMs?: number
}

/**
 * A minimal circuit breaker. While open, calls fail fast (or use the supplied
 * fallback) instead of piling onto a dependency that is already down. After the
 * cool-down it allows a single probe; success closes it, failure re-opens it.
 */
export class CircuitBreaker {
  private state: CircuitState = "closed"
  private failures = 0
  private openedAt = 0
  private readonly threshold: number
  private readonly resetMs: number

  constructor(
    public readonly name: string,
    opts: CircuitOptions = {},
  ) {
    this.threshold = opts.failureThreshold ?? 5
    this.resetMs = opts.resetTimeoutMs ?? 30_000
  }

  get status(): CircuitState {
    // Lazily transition open -> half-open once the cool-down elapses.
    if (this.state === "open" && Date.now() - this.openedAt >= this.resetMs) {
      this.state = "half-open"
    }
    return this.state
  }

  private onSuccess() {
    this.failures = 0
    this.state = "closed"
  }

  private onFailure() {
    this.failures++
    if (this.failures >= this.threshold) {
      this.state = "open"
      this.openedAt = Date.now()
    }
  }

  /**
   * Execute `fn` through the breaker. If the circuit is open the call fails
   * fast: `fallback` is used when provided, otherwise a `CircuitOpenError` is
   * thrown. Pass `fallback` for non-critical paths that should degrade quietly.
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => T | Promise<T>): Promise<T> {
    if (this.status === "open") {
      if (fallback) return fallback()
      throw new CircuitOpenError(this.name)
    }
    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      if (fallback) return fallback()
      throw err
    }
  }
}
