import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import Highlight from "@tiptap/extension-highlight"
import TextAlign from "@tiptap/extension-text-align"
import Subscript from "@tiptap/extension-subscript"
import Superscript from "@tiptap/extension-superscript"
import Typography from "@tiptap/extension-typography"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableHeader } from "@tiptap/extension-table-header"
import { TableCell } from "@tiptap/extension-table-cell"
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight"
import { createLowlight, common } from "lowlight"
import type { Extension, Mark, Node } from "@tiptap/core"
import { Callout, Variable, Tooltip, VideoEmbed, Attachment, FigureImage, Divider } from "./nodes"

const lowlight = createLowlight(common)

/**
 * The single, shared extension set powering every Rich Content editor instance
 * across the app. Built once — no per-surface editor configuration.
 */
export function buildExtensions(placeholder = "متن خود را بنویسید یا / را برای دستورات بزنید…") {
  return [
    StarterKit.configure({
      // Disabled here because we register enhanced/extended versions below.
      link: false,
      codeBlock: false,
      horizontalRule: false,
    }),
    Divider,
    Link.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          // Smart internal links: resolved to a live URL at render time so they
          // never break when a target's slug changes.
          "data-ref-type": {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute("data-ref-type"),
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs["data-ref-type"] ? { "data-ref-type": attrs["data-ref-type"] } : {},
          },
          "data-ref-id": {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute("data-ref-id"),
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs["data-ref-id"] ? { "data-ref-id": attrs["data-ref-id"] } : {},
          },
        }
      },
    }).configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: "noopener noreferrer" },
    }),
    Image.configure({ inline: false, allowBase64: false }),
    Highlight.configure({ multicolor: false }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Subscript,
    Superscript,
    Typography,
    Table.configure({ resizable: true, HTMLAttributes: { class: "rc-table" } }),
    TableRow,
    TableHeader,
    TableCell,
    CodeBlockLowlight.configure({ lowlight }),
    Placeholder.configure({ placeholder }),
    // Custom semantic nodes/marks:
    Callout,
    Variable,
    Tooltip,
    VideoEmbed,
    Attachment,
    FigureImage,
  ] as (Extension | Node | Mark)[]
}
