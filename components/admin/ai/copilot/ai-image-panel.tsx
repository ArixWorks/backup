"use client"

import { useState } from "react"
import { ImageIcon, Loader2, RefreshCw, Wand2, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { IMAGE_ASPECTS, type ImageAspect } from "@/lib/ai/image/constants"
import type { CopilotImageSlot } from "@/lib/ai/copilot/entities"
import { useCopilot } from "./copilot-provider"
import { copilotGenerateImage, copilotGenerateAssetSet, type GeneratedImage } from "./api"

/**
 * AI image generation, embedded in the Copilot panel. One card per entity image
 * slot with edit-prompt / aspect / regenerate / variations, plus a one-click
 * "full asset set" generator. Selected images are applied onto the form via the
 * adapter (slot.formField → form state).
 */
export function AiImagePanel() {
  const { def, adapter, draft } = useCopilot()
  const [assetBusy, setAssetBusy] = useState(false)

  async function generateSet() {
    setAssetBusy(true)
    try {
      const res = await copilotGenerateAssetSet({
        entityId: def.id,
        form: adapter.getForm(),
      })
      let applied = 0
      for (const a of res.data.assets) {
        if (!a.image) continue
        const slot = def.imageSlots.find((s) => s.key === a.slot)
        if (slot?.formField) {
          adapter.applyField(slot.formField, a.image.url)
          applied++
        }
      }
      toast.success(`مجموعه تصاویر ساخته شد (${applied} تصویر روی فرم اعمال شد)`) 
    } catch {
      toast.error("تولید مجموعه تصاویر ناموفق بود")
    } finally {
      setAssetBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ImageIcon className="size-4 text-primary" />
          تصاویر هوش مصنوعی
        </div>
        <Button size="sm" variant="secondary" onClick={generateSet} disabled={assetBusy}>
          {assetBusy ? <Loader2 className="size-4 animate-spin" /> : <Layers className="size-4" />}
          مجموعه کامل
        </Button>
      </div>

      <div className="grid gap-3">
        {def.imageSlots.map((slot) => (
          <ImageSlotCard
            key={slot.key}
            slot={slot}
            entityId={def.id}
            initialPrompt={draft?.imagePrompts?.[slot.key]}
            onApply={(url) => adapter.applyField(slot.formField ?? slot.key, url)}
          />
        ))}
      </div>
    </div>
  )
}

function ImageSlotCard({
  slot,
  entityId,
  initialPrompt,
  onApply,
}: {
  slot: CopilotImageSlot
  entityId: string
  initialPrompt?: string
  onApply: (url: string) => void
}) {
  const { adapter } = useCopilot()
  const [prompt, setPrompt] = useState(initialPrompt ?? "")
  const [aspect, setAspect] = useState<ImageAspect>(slot.aspect)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [busy, setBusy] = useState(false)

  async function run(variations?: number) {
    setBusy(true)
    try {
      const res = await copilotGenerateImage({
        entityId,
        slot: slot.key,
        prompt: prompt || undefined,
        aspect,
        form: adapter.getForm(),
        folder: undefined,
        variations,
      })
      const next = res.data.images ?? (res.data.image ? [res.data.image] : [])
      setImages(next)
      if (next[0]) onApply(next[0].url)
    } catch {
      toast.error(`تولید ${slot.label} ناموفق بود`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{slot.label}</span>
        <Select value={aspect} onValueChange={(v) => setAspect(v as ImageAspect)}>
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IMAGE_ASPECTS.map((a) => (
              <SelectItem key={a} value={a} className="text-xs">
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="پرامپت تصویر (اختیاری، خودکار ساخته می‌شود)"
        className="mb-2 h-8 text-xs"
      />

      {images.length > 0 ? (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <button
              key={img.url}
              type="button"
              onClick={() => onApply(img.url)}
              className="group relative overflow-hidden rounded-md border border-border"
            >
              <img
                src={img.url || "/placeholder.svg"}
                alt={slot.label}
                className="aspect-square w-full object-cover"
                crossOrigin="anonymous"
              />
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={() => run()} disabled={busy} className="h-7 text-xs">
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3" />}
          تولید
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => run(3)}
          disabled={busy}
          className="h-7 text-xs"
        >
          <RefreshCw className="size-3" />
          چند نسخه
        </Button>
      </div>
    </div>
  )
}
