import "server-only"

/**
 * Recipient validation. Runs before anything is queued so we never burn sender
 * reputation on addresses that are guaranteed to bounce. Three layers:
 *   1. Syntactic validity (RFC-ish, conservative).
 *   2. Reserved / special-use domains (RFC 2606 / 6761) — always rejected.
 *   3. Disposable inboxes — rejected only when the admin opts in.
 */

// RFC 2606 + 6761 reserved/special-use domains and TLDs. Mail to these can
// never be delivered, so we reject up front instead of bouncing.
const RESERVED_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "example.edu",
  "test.com",
  "localhost",
  "invalid",
  "local",
])

const RESERVED_TLDS = new Set(["test", "example", "invalid", "localhost", "local"])

// A compact list of well-known disposable/temporary mail providers. Blocking is
// opt-in via the `email.blockDisposable` setting; the list is intentionally
// small and can be extended without code changes by future settings work.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "sharklasers.com",
  "maildrop.cc",
  "dispostable.com",
  "fakeinbox.com",
  "mailnesia.com",
  "mohmal.com",
])

// Reasonably strict single-line address pattern. We deliberately avoid the full
// RFC 5322 monster regex; this rejects the realistic mistakes that cause bounces.
const ADDRESS_RE = /^[^\s@"(),:;<>[\]\\]+@[^\s@.]+(\.[^\s@.]+)+$/

export type EmailRejectionReason =
  | "empty"
  | "malformed"
  | "reserved_domain"
  | "disposable"

export interface ValidationResult {
  ok: boolean
  /** Normalised (lowercased, trimmed) address. */
  email: string
  reason?: EmailRejectionReason
  message?: string
}

const REASON_MESSAGE: Record<EmailRejectionReason, string> = {
  empty: "آدرس ایمیل خالی است",
  malformed: "قالب آدرس ایمیل نامعتبر است",
  reserved_domain: "دامنه ایمیل رزرو‌شده است و قابل ارسال نیست",
  disposable: "ایمیل‌های موقت/یک‌بارمصرف پذیرفته نمی‌شوند",
}

export function normalizeEmail(input: string): string {
  return (input ?? "").trim().toLowerCase()
}

function domainOf(email: string): string {
  const at = email.lastIndexOf("@")
  return at === -1 ? "" : email.slice(at + 1)
}

/**
 * Validate a recipient address. `blockDisposable` should come from the
 * `email.blockDisposable` setting (admin-controlled, not hardcoded behaviour).
 */
export function validateEmail(
  input: string,
  opts: { blockDisposable?: boolean } = {},
): ValidationResult {
  const email = normalizeEmail(input)
  if (!email) return fail(email, "empty")
  if (email.length > 254 || !ADDRESS_RE.test(email)) return fail(email, "malformed")

  const domain = domainOf(email)
  const tld = domain.slice(domain.lastIndexOf(".") + 1)
  if (RESERVED_DOMAINS.has(domain) || RESERVED_TLDS.has(tld)) {
    return fail(email, "reserved_domain")
  }
  if (opts.blockDisposable && DISPOSABLE_DOMAINS.has(domain)) {
    return fail(email, "disposable")
  }
  return { ok: true, email }
}

function fail(email: string, reason: EmailRejectionReason): ValidationResult {
  return { ok: false, email, reason, message: REASON_MESSAGE[reason] }
}

export function isDisposableDomain(email: string): boolean {
  return DISPOSABLE_DOMAINS.has(domainOf(normalizeEmail(email)))
}
