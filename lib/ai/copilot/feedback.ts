import "server-only"
import { getSetting, setSetting } from "@/lib/core/settings"

/**
 * Feedback learning (in-context, not model training).
 *
 * When an admin edits an AI suggestion before saving, we record the diff
 * (AI value → admin value). On later generations for the same entity we inject
 * a short digest of the most recent edits as a "style guide" — few-shot
 * in-context learning that gradually aligns the Copilot with the admin's voice.
 *
 * Stored as a JSON array in the generic `Setting` K/V table under
 * `ai.copilot.feedback.<entityId>` — no schema migration required.
 */

const MAX_ENTRIES = 40
const HINT_ENTRIES = 8

interface FeedbackEntry {
  field: string
  ai: string
  admin: string
  at: number
}

function key(entityId: string) {
  return `ai.copilot.feedback.${entityId}`
}

async function read(entityId: string): Promise<FeedbackEntry[]> {
  const raw = await getSetting(key(entityId))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as FeedbackEntry[]) : []
  } catch {
    return []
  }
}

/** Persist one or more field edits made by the admin against AI output. */
export async function recordEdits(
  entityId: string,
  edits: { field: string; ai: string; admin: string }[],
): Promise<void> {
  const meaningful = edits
    .filter((e) => e.ai && e.admin && e.ai.trim() !== e.admin.trim())
    // Keep the digest lightweight — cap each value.
    .map((e) => ({ field: e.field, ai: e.ai.slice(0, 400), admin: e.admin.slice(0, 400), at: Date.now() }))
  if (!meaningful.length) return
  const existing = await read(entityId)
  const next = [...meaningful, ...existing].slice(0, MAX_ENTRIES)
  await setSetting(key(entityId), JSON.stringify(next))
}

/** Build a short natural-language style guide from recent edits. */
export async function getStyleHints(entityId: string): Promise<string> {
  const entries = await read(entityId)
  if (!entries.length) return ""
  return entries
    .slice(0, HINT_ENTRIES)
    .map((e) => `- در فیلد «${e.field}»، مدیر «${e.ai}» را به «${e.admin}» تغییر داد.`)
    .join("\n")
}
