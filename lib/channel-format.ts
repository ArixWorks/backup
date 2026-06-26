/**
 * Shared caption builder for channel posts. Used by the admin composer for the
 * live preview and to produce the exact HTML caption sent to Telegram, so the
 * preview always matches the published post.
 */

export type ChannelFields = {
  title: string
  body: string
}

/** Escape the few characters Telegram's HTML parse mode cares about. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Build the HTML caption. The title becomes a bold first line; the body keeps
 * the admin's line breaks. Empty fields are skipped.
 */
export function buildCaption(fields: ChannelFields): string {
  const parts: string[] = []
  const title = fields.title.trim()
  const body = fields.body.trim()
  if (title) parts.push(`<b>${escapeHtml(title)}</b>`)
  if (body) parts.push(escapeHtml(body))
  return parts.join("\n\n")
}
