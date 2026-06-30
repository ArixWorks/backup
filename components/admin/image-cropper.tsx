"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { RotateCw, ZoomIn, ZoomOut, X, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Point = { x: number; y: number }

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const OUTPUT_MAX = 1600 // longest cropped edge, keeps files small but crisp

/**
 * Telegram/YouTube-style image cropper.
 *
 * Shows the picked image inside a fixed crop frame (rectangular or round) of the
 * target aspect ratio. The admin drags to pan, pinches/scrolls/uses the slider to
 * zoom, and can rotate in 90° steps. "ثبت تصویر" renders the visible crop region
 * to a canvas and returns a compressed WebP Blob via onCropped.
 */
export function ImageCropper({
  src,
  aspect,
  cropShape = "rect",
  onCropped,
  onCancel,
  title = "تنظیم تصویر",
}: {
  src: string
  aspect: number
  cropShape?: "rect" | "round"
  onCropped: (blob: Blob) => void | Promise<void>
  onCancel: () => void
  title?: string
}) {
  const [mounted, setMounted] = useState(false)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [rotation, setRotation] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [frame, setFrame] = useState({ w: 0, h: 0 })
  const [busy, setBusy] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)
  const pointers = useRef<Map<number, Point>>(new Map())

  useEffect(() => setMounted(true), [])

  // Load the image element so we know its natural dimensions.
  useEffect(() => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => setImg(image)
    image.src = src
  }, [src])

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancel])

  // Compute the on-screen crop frame so it fits inside the stage with the target aspect.
  const measure = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const pad = 32
    const availW = stage.clientWidth - pad * 2
    const availH = stage.clientHeight - pad * 2
    let w = availW
    let h = w / aspect
    if (h > availH) {
      h = availH
      w = h * aspect
    }
    setFrame({ w: Math.max(40, w), h: Math.max(40, h) })
  }, [aspect])

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (stageRef.current) ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [measure])

  // Rotated natural dimensions of the source.
  const natural = useMemo(() => {
    if (!img) return { w: 0, h: 0 }
    const swap = rotation % 180 !== 0
    return { w: swap ? img.naturalHeight : img.naturalWidth, h: swap ? img.naturalWidth : img.naturalHeight }
  }, [img, rotation])

  // Base "cover" size of the (rotated) image inside the crop frame at zoom = 1.
  const base = useMemo(() => {
    if (!natural.w || !frame.w) return { w: 0, h: 0 }
    const scale = Math.max(frame.w / natural.w, frame.h / natural.h)
    return { w: natural.w * scale, h: natural.h * scale }
  }, [natural, frame])

  const rendered = useMemo(() => ({ w: base.w * zoom, h: base.h * zoom }), [base, zoom])

  // Clamp the pan so the frame is always fully covered by the image.
  const clamp = useCallback(
    (p: Point, z = zoom): Point => {
      const rw = base.w * z
      const rh = base.h * z
      const maxX = Math.max(0, (rw - frame.w) / 2)
      const maxY = Math.max(0, (rh - frame.h) / 2)
      return {
        x: Math.min(maxX, Math.max(-maxX, p.x)),
        y: Math.min(maxY, Math.max(-maxY, p.y)),
      }
    },
    [base, frame, zoom],
  )

  useEffect(() => {
    setCrop((c) => clamp(c))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, base.w, base.h, frame.w, frame.h, rotation])

  // ---- Pointer handlers (pan + pinch) ----
  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom }
      drag.current = null
    } else {
      drag.current = { startX: e.clientX, startY: e.clientY, baseX: crop.x, baseY: crop.y }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinch.current.zoom * (dist / pinch.current.dist)))
      setZoom(next)
      return
    }
    if (drag.current) {
      const dx = e.clientX - drag.current.startX
      const dy = e.clientY - drag.current.startY
      setCrop(clamp({ x: drag.current.baseX + dx, y: drag.current.baseY + dy }))
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }

  function onWheel(e: React.WheelEvent) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom - e.deltaY * 0.0015))
    setZoom(next)
  }

  function rotate() {
    setRotation((r) => (r + 90) % 360)
    setZoom(1)
    setCrop({ x: 0, y: 0 })
  }

  // ---- Produce the cropped blob ----
  async function confirm() {
    if (!img || !frame.w) return
    setBusy(true)
    try {
      const pxPerUnit = natural.w / rendered.w // source px per on-screen px
      const cropW = frame.w * pxPerUnit
      const cropH = frame.h * pxPerUnit
      // Top-left of the frame in rotated-source pixels.
      const sx = (-frame.w / 2 - crop.x + rendered.w / 2) * pxPerUnit
      const sy = (-frame.h / 2 - crop.y + rendered.h / 2) * pxPerUnit

      // Output canvas, scaled down so the longest edge <= OUTPUT_MAX.
      const scale = Math.min(1, OUTPUT_MAX / Math.max(cropW, cropH))
      const outW = Math.round(cropW * scale)
      const outH = Math.round(cropH * scale)
      const canvas = document.createElement("canvas")
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("no ctx")
      ctx.imageSmoothingQuality = "high"

      // Draw the (rotated) image, then copy the crop window into the output.
      // We render onto a rotated offscreen canvas first so source coords match `natural`.
      const off = document.createElement("canvas")
      off.width = natural.w
      off.height = natural.h
      const octx = off.getContext("2d")!
      octx.translate(off.width / 2, off.height / 2)
      octx.rotate((rotation * Math.PI) / 180)
      octx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)

      ctx.drawImage(off, sx, sy, cropW, cropH, 0, 0, outW, outH)

      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/webp",
          0.9,
        ),
      )
      await onCropped(blob)
    } finally {
      setBusy(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-bold">{title}</span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="بستن"
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="relative flex-1 touch-none select-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {/* Image */}
        {img && (
          <img
            src={src || "/placeholder.svg"}
            alt=""
            draggable={false}
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
            style={{
              width: rendered.w,
              height: rendered.h,
              transform: `translate(-50%, -50%) translate(${crop.x}px, ${crop.y}px) rotate(${rotation}deg)`,
            }}
          />
        )}

        {/* Dim overlay with a transparent window the size of the frame */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: frame.w, height: frame.h }}
        >
          <div
            className={cn(
              "h-full w-full ring-2 ring-primary",
              cropShape === "round" ? "rounded-full" : "rounded-md",
            )}
            style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" }}
          />
        </div>

        {!img && (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-3 border-t border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="بزرگ‌نمایی"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
          <button
            type="button"
            onClick={rotate}
            aria-label="چرخش"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-foreground transition hover:bg-secondary"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || !img}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            ثبت تصویر
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
