export type InlineAction = "rewrite" | "expand" | "shorten" | "improve" | "translate" | "seo" | "grammar"

export interface RichContentEditorProps {
  /** Controlled semantic-HTML value. */
  value: string
  /** Fired (debounced) whenever the document changes, with sanitized HTML. */
  onChange: (html: string) => void
  /** Placeholder shown when empty. */
  placeholder?: string
  /**
   * Stable identity of the field being edited, used for local draft recovery
   * and (optionally) server-side revision history. e.g. "product:123:description".
   */
  storageKey?: string
  /** Enables server revision snapshots via the revisions API. */
  revision?: { entityType: string; entityId: string; field?: string }
  /** Show the live SEO assistant panel. */
  seo?: boolean
  /** Disable AI features (bubble-menu actions, AI slash commands). */
  disableAi?: boolean
  /** Minimum editable height (Tailwind class or inline). */
  minHeight?: number
  className?: string
}
