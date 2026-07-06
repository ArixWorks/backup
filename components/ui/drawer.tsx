"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

/**
 * Side / bottom Drawer (a.k.a. Sheet) built on the same base-ui Dialog engine as
 * our modal Dialog, so focus-trapping, scroll-locking and a11y are identical.
 * Used for the mobile navigation drawer and as the mobile face of
 * ResponsiveDialog. Slides in from an edge and respects safe-area insets.
 */

function Drawer({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-overlay/70 duration-200 supports-backdrop-filter:backdrop-blur-md data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  )
}

type DrawerSide = "start" | "end" | "bottom"

/** Side-anchored slide + safe-area padding for each edge. */
const SIDE_CLASSES: Record<DrawerSide, string> = {
  // `start`/`end` are logical so RTL flips them automatically (sidebar sits on
  // the right in our RTL app). Base-ui doesn't ship slide-from-inline-edge
  // keyframes, so we fade+translate via data-state utilities.
  end: "inset-y-0 end-0 h-full w-[min(20rem,88vw)] border-s px-safe pt-safe data-closed:translate-x-4 rtl:data-closed:-translate-x-4",
  start:
    "inset-y-0 start-0 h-full w-[min(20rem,88vw)] border-e px-safe pt-safe data-closed:-translate-x-4 rtl:data-closed:translate-x-4",
  bottom:
    "inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-2xl border-t pb-safe data-closed:translate-y-6",
}

function DrawerContent({
  className,
  children,
  side = "end",
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  side?: DrawerSide
  showCloseButton?: boolean
}) {
  return (
    <DialogPrimitive.Portal>
      <DrawerOverlay />
      <DialogPrimitive.Popup
        data-slot="drawer-content"
        className={cn(
          "glass elevate-lg fixed z-50 flex flex-col overflow-hidden border-border/70 bg-popover text-popover-foreground outline-none duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          SIDE_CLASSES[side],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            render={<Button variant="ghost" size="icon-sm" className="absolute top-3 end-3 z-20 rounded-full" />}
          >
            <XIcon />
            <span className="sr-only">بستن</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex shrink-0 flex-col gap-1 border-b border-border/60 px-5 pt-5 pb-4 pe-12 text-start", className)}
      {...props}
    />
  )
}

function DrawerBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-body"
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4", className)}
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="drawer-title"
      className={cn("font-heading text-base leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DrawerDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerTitle,
  DrawerDescription,
}
