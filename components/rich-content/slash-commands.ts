import type { Editor } from "@tiptap/react"
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Minus,
  Table as TableIcon,
  ImageIcon,
  Film,
  Paperclip,
  Info,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

export interface SlashCommand {
  key: string
  title: string
  description: string
  icon: LucideIcon
  keywords: string[]
  group: "basic" | "media" | "advanced" | "ai"
  /**
   * Run the command. `openDialog` lets a command defer to a UI dialog handled
   * by the editor (media picker, embed URL, AI menu…).
   */
  run: (editor: Editor, openDialog: (name: DialogName) => void) => void
}

export type DialogName = "media" | "embed" | "attachment" | "callout" | "ai" | "table" | "variable" | "link" | "emoji"

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    key: "h1",
    title: "عنوان بزرگ",
    description: "سرتیتر سطح ۱",
    icon: Heading1,
    keywords: ["h1", "heading", "title", "عنوان", "سرتیتر"],
    group: "basic",
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    key: "h2",
    title: "عنوان متوسط",
    description: "سرتیتر سطح ۲",
    icon: Heading2,
    keywords: ["h2", "heading", "عنوان"],
    group: "basic",
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    key: "h3",
    title: "عنوان کوچک",
    description: "سرتیتر سطح ۳",
    icon: Heading3,
    keywords: ["h3", "heading", "عنوان"],
    group: "basic",
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    key: "bullet",
    title: "فهرست نقطه‌ای",
    description: "لیست بدون ترتیب",
    icon: List,
    keywords: ["ul", "bullet", "list", "فهرست", "لیست"],
    group: "basic",
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    key: "ordered",
    title: "فهرست شماره‌دار",
    description: "لیست مرتب",
    icon: ListOrdered,
    keywords: ["ol", "ordered", "number", "شماره", "لیست"],
    group: "basic",
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    key: "quote",
    title: "نقل‌قول",
    description: "بلوک نقل‌قول",
    icon: Quote,
    keywords: ["quote", "blockquote", "نقل"],
    group: "basic",
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    key: "code",
    title: "بلوک کد",
    description: "کد با هایلایت نحوی",
    icon: Code2,
    keywords: ["code", "pre", "کد"],
    group: "basic",
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    key: "divider",
    title: "جداکننده",
    description: "خط افقی",
    icon: Minus,
    keywords: ["hr", "divider", "rule", "جدا"],
    group: "basic",
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    key: "table",
    title: "جدول",
    description: "درج جدول",
    icon: TableIcon,
    keywords: ["table", "grid", "جدول"],
    group: "advanced",
    run: (_e, open) => open("table"),
  },
  {
    key: "image",
    title: "تصویر",
    description: "از کتابخانه رسانه",
    icon: ImageIcon,
    keywords: ["image", "photo", "img", "تصویر", "عکس"],
    group: "media",
    run: (_e, open) => open("media"),
  },
  {
    key: "video",
    title: "ویدیو",
    description: "یوتیوب، آپارات، ویمئو…",
    icon: Film,
    keywords: ["video", "embed", "youtube", "aparat", "ویدیو"],
    group: "media",
    run: (_e, open) => open("embed"),
  },
  {
    key: "attachment",
    title: "پیوست",
    description: "کارت دانلود فایل",
    icon: Paperclip,
    keywords: ["file", "attachment", "download", "پیوست", "فایل"],
    group: "media",
    run: (_e, open) => open("attachment"),
  },
  {
    key: "callout",
    title: "کالاوت",
    description: "جعبه نکته/هشدار",
    icon: Info,
    keywords: ["callout", "note", "warning", "info", "نکته", "هشدار"],
    group: "advanced",
    run: (_e, open) => open("callout"),
  },
  {
    key: "variable",
    title: "متغیر",
    description: "متغیر پویا (مثل نام کاربر)",
    icon: Sparkles,
    keywords: ["variable", "var", "placeholder", "متغیر"],
    group: "advanced",
    run: (_e, open) => open("variable"),
  },
  {
    key: "ai",
    title: "دستیار هوش مصنوعی",
    description: "تولید یا بهبود متن",
    icon: Sparkles,
    keywords: ["ai", "assistant", "generate", "هوش", "دستیار"],
    group: "ai",
    run: (_e, open) => open("ai"),
  },
]

export const GROUP_LABEL: Record<SlashCommand["group"], string> = {
  basic: "پایه",
  media: "رسانه",
  advanced: "پیشرفته",
  ai: "هوش مصنوعی",
}
