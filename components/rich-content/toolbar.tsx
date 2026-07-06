"use client"

import { type Editor } from "@tiptap/react"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  ImageIcon,
  Table as TableIcon,
  Highlighter,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Undo2,
  Redo2,
  Minus,
  Code2,
  Smile,
  Maximize2,
  Minimize2,
  Info,
} from "lucide-react"
import { Toggle } from "@/components/ui/toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface ToolbarProps {
  editor: Editor
  fullscreen: boolean
  onToggleFullscreen: () => void
  onOpenMedia: () => void
  onOpenLink: () => void
  onOpenEmoji: () => void
  onOpenCallout: () => void
  onInsertTable: () => void
}

/**
 * Responsive editor toolbar. On small screens it becomes a horizontally
 * scrollable single row (sticky at the top of the editor); on larger screens
 * it wraps into grouped controls. All buttons are icon-only with sr-only
 * labels for accessibility.
 */
export function Toolbar({
  editor,
  fullscreen,
  onToggleFullscreen,
  onOpenMedia,
  onOpenLink,
  onOpenEmoji,
  onOpenCallout,
  onInsertTable,
}: ToolbarProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto rounded-t-lg border-b border-border bg-card/95 p-1.5 backdrop-blur supports-[backdrop-filter]:bg-card/80 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Group>
        <TbToggle pressed={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="پررنگ">
          <Bold className="size-4" />
        </TbToggle>
        <TbToggle pressed={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="مورب">
          <Italic className="size-4" />
        </TbToggle>
        <TbToggle pressed={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} label="زیرخط">
          <UnderlineIcon className="size-4" />
        </TbToggle>
        <TbToggle pressed={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} label="خط‌خورده">
          <Strikethrough className="size-4" />
        </TbToggle>
        <TbToggle pressed={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} label="هایلایت">
          <Highlighter className="size-4" />
        </TbToggle>
        <TbToggle pressed={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} label="کد درون‌خطی">
          <Code className="size-4" />
        </TbToggle>
      </Group>

      <Sep />

      <Group>
        <TbToggle pressed={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} label="عنوان ۱">
          <Heading1 className="size-4" />
        </TbToggle>
        <TbToggle pressed={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="عنوان ۲">
          <Heading2 className="size-4" />
        </TbToggle>
        <TbToggle pressed={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="عنوان ۳">
          <Heading3 className="size-4" />
        </TbToggle>
      </Group>

      <Sep />

      <Group>
        <TbToggle pressed={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="فهرست نقطه‌ای">
          <List className="size-4" />
        </TbToggle>
        <TbToggle pressed={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="فهرست شماره‌دار">
          <ListOrdered className="size-4" />
        </TbToggle>
        <TbToggle pressed={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="نقل‌قول">
          <Quote className="size-4" />
        </TbToggle>
        <TbToggle pressed={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} label="بلوک کد">
          <Code2 className="size-4" />
        </TbToggle>
      </Group>

      <Sep />

      <Group>
        <TbToggle pressed={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} label="راست‌چین">
          <AlignRight className="size-4" />
        </TbToggle>
        <TbToggle pressed={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} label="وسط‌چین">
          <AlignCenter className="size-4" />
        </TbToggle>
        <TbToggle pressed={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} label="چپ‌چین">
          <AlignLeft className="size-4" />
        </TbToggle>
      </Group>

      <Sep />

      <Group>
        <TbBtn onClick={onOpenLink} label="پیوند" active={editor.isActive("link")}>
          <Link2 className="size-4" />
        </TbBtn>
        <TbBtn onClick={onOpenMedia} label="رسانه">
          <ImageIcon className="size-4" />
        </TbBtn>
        <TbBtn onClick={onInsertTable} label="جدول">
          <TableIcon className="size-4" />
        </TbBtn>
        <TbBtn onClick={onOpenCallout} label="کالاوت">
          <Info className="size-4" />
        </TbBtn>
        <TbBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} label="جداکننده">
          <Minus className="size-4" />
        </TbBtn>
        <TbBtn onClick={onOpenEmoji} label="اموجی">
          <Smile className="size-4" />
        </TbBtn>
      </Group>

      <Sep />

      <Group>
        <TbBtn onClick={() => editor.chain().focus().undo().run()} label="واگرد" disabled={!editor.can().undo()}>
          <Undo2 className="size-4" />
        </TbBtn>
        <TbBtn onClick={() => editor.chain().focus().redo().run()} label="ازنو" disabled={!editor.can().redo()}>
          <Redo2 className="size-4" />
        </TbBtn>
      </Group>

      <div className="ms-auto ps-1">
        <TbBtn onClick={onToggleFullscreen} label={fullscreen ? "خروج از تمام‌صفحه" : "تمام‌صفحه"}>
          {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </TbBtn>
      </div>
    </div>
  )
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>
}

function Sep() {
  return <Separator orientation="vertical" className="mx-1 h-6 shrink-0" />
}

function TbToggle({
  pressed,
  onClick,
  label,
  children,
}: {
  pressed: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <Toggle
      size="sm"
      pressed={pressed}
      onPressedChange={onClick}
      aria-label={label}
      title={label}
      className="size-8 shrink-0 p-0 data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
    >
      {children}
      <span className="sr-only">{label}</span>
    </Toggle>
  )
}

function TbBtn({
  onClick,
  label,
  children,
  disabled,
  active,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
  disabled?: boolean
  active?: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn("size-8 shrink-0", active && "bg-primary/15 text-primary")}
    >
      {children}
      <span className="sr-only">{label}</span>
    </Button>
  )
}
