import type { BotConfig } from "./config"

/**
 * Telegram premium/animated emoji are rendered with HTML parse mode using the
 * <tg-emoji emoji-id="..."> tag (Bot API). This lets a single message mix
 * bold text, normal emoji, AND premium animated emoji at once — which the
 * older "entities" approach could not do (entities and parse_mode are
 * mutually exclusive). See Telegram "Button UI" guidance.
 */

/** HTML-escape a string for Telegram HTML parse mode. */
export function esc(s: string | number): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/** Bold an (escaped) value: <b>...</b>. */
export function b(s: string | number): string {
  return `<b>${esc(s)}</b>`
}

/**
 * HTML for a named emoji from config. If a premium custom emoji id is set for
 * that name we emit <tg-emoji emoji-id="ID">glyph</tg-emoji> (glyph is the
 * visible fallback); otherwise just the plain glyph (auto-animated by Telegram
 * for Premium users).
 */
export function emo(cfg: BotConfig, name: string): string {
  const glyph = cfg.emoji[name] ?? ""
  const custom = cfg.customEmoji[name]
  if (custom?.id) {
    return `<tg-emoji emoji-id="${esc(custom.id)}">${esc(custom.fallback || glyph || "✨")}</tg-emoji>`
  }
  return esc(glyph)
}

/**
 * Render a template string into final Telegram HTML.
 *
 * - {key} placeholders resolve from config.emoji (→ emoji/premium-emoji HTML)
 *   or from `vars` (HTML-escaped).
 * - `*bold*` Markdown segments are converted to <b>bold</b>.
 * - All literal text and variable values are HTML-escaped so user-generated
 *   content (product titles, error reasons) can never break the markup.
 */
export function render(
  template: string,
  cfg: BotConfig,
  vars: Record<string, string | number> = {},
): { html: string } {
  let out = ""
  let boldOpen = false
  let i = 0

  while (i < template.length) {
    const ch = template[i]

    if (ch === "{") {
      const close = template.indexOf("}", i)
      if (close === -1) {
        out += esc(template.slice(i))
        break
      }
      const token = template.slice(i + 1, close)
      i = close + 1
      if (token in cfg.emoji) out += emo(cfg, token)
      else if (token in vars) out += esc(vars[token])
      else out += esc(`{${token}}`)
      continue
    }

    if (ch === "*") {
      // Toggle bold. A *...* run can safely span tokens (e.g. *{total}*).
      out += boldOpen ? "</b>" : "<b>"
      boldOpen = !boldOpen
      i++
      continue
    }

    out += esc(ch)
    i++
  }

  if (boldOpen) out += "</b>"
  return { html: out }
}
