import { z } from "zod"
import { sanitizeRichHtml } from "./sanitize"

/**
 * Zod schema for a rich-content field (product/auction/giveaway descriptions,
 * article bodies, …). Sanitizes on parse so unsafe HTML can never reach the
 * database, regardless of which API route or client submitted it.
 *
 * `max` guards against abuse / oversized payloads (measured on the raw string
 * before sanitization).
 */
export function richTextField(max = 200_000) {
  return z
    .string()
    .max(max, `محتوا نمی‌تواند بیش از ${max} نویسه باشد`)
    .transform((v) => sanitizeRichHtml(v))
}
