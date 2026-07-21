import { MESSAGES } from "../lib/i18n/messages"
import type { Locale } from "../lib/i18n/locales"

const locales: Locale[] = ["fa", "en", "hi", "ru"]
const referenceKeys = new Set(Object.keys(MESSAGES.fa))
const failures: string[] = []

for (const locale of locales) {
  const catalog = MESSAGES[locale] as Record<string, string>
  const keys = new Set(Object.keys(catalog))
  for (const key of referenceKeys) {
    if (!keys.has(key) || !catalog[key]?.trim()) failures.push(`${locale}: missing ${key}`)
  }
  for (const key of keys) {
    if (!referenceKeys.has(key)) failures.push(`${locale}: unexpected ${key}`)
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exit(1)
}

console.log(`Message parity passed: ${referenceKeys.size} keys across ${locales.length} locales.`)
