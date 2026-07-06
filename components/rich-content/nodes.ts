import { Node, Mark, mergeAttributes } from "@tiptap/core"
import HorizontalRule from "@tiptap/extension-horizontal-rule"

/**
 * Custom Tiptap nodes/marks for the Rich Content editor. Each one defines a
 * clean `parseHTML`/`renderHTML` pair so the editor round-trips to and from
 * standard *semantic* HTML — the canonical storage format. No proprietary JSON
 * is ever persisted, which keeps content portable if the editor changes.
 *
 * Insertion is done from the toolbar/slash menu via `insertContent(htmlString)`
 * (atoms) or the built-in `toggleWrap`/`setMark` commands (callout/tooltip), so
 * no custom command typing/augmentation is required.
 */

/* Callout / admonition box: <aside data-callout="info"> … </aside> */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      kind: {
        default: "info",
        parseHTML: (el) => el.getAttribute("data-callout") || "info",
        renderHTML: (attrs) => ({ "data-callout": attrs.kind }),
      },
    }
  },
  parseHTML() {
    return [{ tag: "aside[data-callout]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["aside", mergeAttributes(HTMLAttributes), 0]
  },
})

/* Template variable placeholder: <span data-var="product.name" data-fallback="…"> */
export const Variable = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      varKey: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-var") || "",
        renderHTML: (attrs) => ({ "data-var": attrs.varKey }),
      },
      fallback: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-fallback") || "",
        renderHTML: (attrs) => ({ "data-fallback": attrs.fallback }),
      },
    }
  },
  parseHTML() {
    return [{ tag: "span[data-var]" }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), node.attrs.fallback || `{{${node.attrs.varKey}}}`]
  },
  renderText({ node }) {
    return `{{${node.attrs.varKey}}}`
  },
})

/* Tooltip mark: <span data-tooltip="explanation" title="explanation"> … </span> */
export const Tooltip = Mark.create({
  name: "tooltip",
  inclusive: false,
  addAttributes() {
    return {
      text: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-tooltip") || "",
        renderHTML: (attrs) => ({ "data-tooltip": attrs.text, title: attrs.text }),
      },
      pos: {
        default: "top",
        parseHTML: (el) => el.getAttribute("data-tooltip-pos") || "top",
        renderHTML: (attrs) => ({ "data-tooltip-pos": attrs.pos }),
      },
    }
  },
  parseHTML() {
    return [{ tag: "span[data-tooltip]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0]
  },
})

/* Video embed (atom): <div data-embed data-provider="youtube"><iframe …/></div> */
export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (el) => el.querySelector("iframe")?.getAttribute("src") || el.getAttribute("data-src") || "",
        renderHTML: (attrs) => ({ "data-src": attrs.src }),
      },
      provider: {
        default: "generic",
        parseHTML: (el) => el.getAttribute("data-provider") || "generic",
        renderHTML: (attrs) => ({ "data-provider": attrs.provider }),
      },
    }
  },
  parseHTML() {
    return [{ tag: "div[data-embed]" }]
  },
  renderHTML({ node }) {
    return [
      "div",
      { "data-embed": "", "data-provider": node.attrs.provider },
      [
        "iframe",
        {
          src: node.attrs.src,
          allowfullscreen: "true",
          frameborder: "0",
          allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        },
      ],
    ]
  },
})

/* Attachment card (atom): <a data-type="attachment" href download> … </a> */
export const Attachment = Node.create({
  name: "attachment",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      href: { default: "", parseHTML: (el) => el.getAttribute("href") || "" },
      filename: {
        default: "فایل",
        parseHTML: (el) => el.getAttribute("data-filename") || el.textContent || "فایل",
        renderHTML: (attrs) => ({ "data-filename": attrs.filename }),
      },
      size: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-size") || "",
        renderHTML: (attrs) => ({ "data-size": attrs.size }),
      },
      mime: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-mime") || "",
        renderHTML: (attrs) => ({ "data-mime": attrs.mime }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'a[data-type="attachment"]' }]
  },
  renderHTML({ node }) {
    return [
      "a",
      {
        "data-type": "attachment",
        href: node.attrs.href,
        target: "_blank",
        rel: "noopener noreferrer",
        download: "",
        "data-filename": node.attrs.filename,
        "data-size": node.attrs.size,
        "data-mime": node.attrs.mime,
      },
      ["span", { class: "rc-att-name" }, node.attrs.filename],
      ["span", { class: "rc-att-meta" }, node.attrs.size || node.attrs.mime || "دانلود"],
    ]
  },
})

/* Figure with caption: <figure><img …><figcaption>…</figcaption></figure> */
export const FigureImage = Node.create({
  name: "figureImage",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: "", parseHTML: (el) => el.querySelector("img")?.getAttribute("src") || "" },
      alt: { default: "", parseHTML: (el) => el.querySelector("img")?.getAttribute("alt") || "" },
      caption: { default: "", parseHTML: (el) => el.querySelector("figcaption")?.textContent || "" },
      align: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-align") || "center",
      },
    }
  },
  parseHTML() {
    return [{ tag: "figure[data-type='image']" }]
  },
  renderHTML({ node }) {
    const children: unknown[] = [
      ["img", { src: node.attrs.src, alt: node.attrs.alt, loading: "lazy", decoding: "async" }],
    ]
    if (node.attrs.caption) children.push(["figcaption", {}, node.attrs.caption])
    return ["figure", { "data-type": "image", "data-align": node.attrs.align }, ...children]
  },
})

/* Divider variants: extends the built-in <hr> to carry a visual variant. */
export const Divider = HorizontalRule.extend({
  addAttributes() {
    return {
      variant: {
        default: "simple",
        parseHTML: (el) => el.getAttribute("data-variant") || "simple",
        renderHTML: (attrs) => (attrs.variant === "simple" ? {} : { "data-variant": attrs.variant }),
      },
    }
  },
})
