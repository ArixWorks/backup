/**
 * Rich Content Platform — public surface.
 *
 * The single shared editor + renderer used across every long-form content
 * surface in the project. Import from here rather than the internal files.
 */
export { RichContentEditor, type RichContentEditorProps } from "./rich-content-editor"
export { RichContent } from "./rich-content"
export { EnhancedTextarea } from "./enhanced-textarea"
export { MediaManager } from "./media-manager"
export type { MediaAssetDTO } from "./client-api"
