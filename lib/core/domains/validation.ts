import "server-only"
import { domainToASCII, domainToUnicode } from "node:url"
import { z } from "zod"
import { ValidationError } from "@/lib/core/errors"

const labelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export const domainInputSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .transform((value) => value.replace(/^https?:\/\//i, "").split(/[/?#]/, 1)[0].replace(/\.$/, ""))

export interface NormalizedDomain {
  asciiDomain: string
  unicodeDomain: string
  label: string
  tld: string
}

export function normalizeDomain(input: string): NormalizedDomain {
  const raw = domainInputSchema.parse(input).toLowerCase()
  const asciiDomain = domainToASCII(raw)
  if (!asciiDomain || asciiDomain.length > 253) throw new ValidationError("نام دامنه معتبر نیست.")

  const parts = asciiDomain.split(".")
  if (parts.length !== 2) throw new ValidationError("لطفاً دامنه را همراه با پسوند وارد کنید.")
  const [label, tld] = parts
  if (!labelPattern.test(label) || !labelPattern.test(tld) || tld.length < 2) {
    throw new ValidationError("ساختار دامنه معتبر نیست.")
  }

  return { asciiDomain, unicodeDomain: domainToUnicode(asciiDomain), label, tld: `.${tld}` }
}

export function normalizeLabel(input: string): string {
  const ascii = domainToASCII(input.trim().toLowerCase())
  if (!ascii || ascii.includes(".") || !labelPattern.test(ascii)) {
    throw new ValidationError("نام پیشنهادی معتبر نیست.")
  }
  return ascii
}
