"use client"

import { useMinWidth } from "@/lib/responsive/use-breakpoint"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
} from "@/components/ui/drawer"

/**
 * One overlay component that renders the right pattern for the device:
 *  - Desktop (md+): a centered modal Dialog.
 *  - Mobile (<md):  a bottom Drawer/Sheet — the reachable, thumb-friendly
 *    pattern with safe-area padding.
 *
 * Same props for both, so every AI panel / editor / confirm across the app
 * behaves natively on each device from a single call site. Content only mounts
 * while open, so switching patterns never causes layout shift.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  size = "default",
  className,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: "sm" | "default" | "lg" | "xl" | "2xl"
  className?: string
}) {
  const isDesktop = useMinWidth("md")

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger render={trigger as React.ReactElement} />}
        <DialogContent size={size} className={className}>
          {(title || description) && (
            <DialogHeader>
              {title && <DialogTitle>{title}</DialogTitle>}
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
          )}
          <DialogBody>{children}</DialogBody>
          {footer && <DialogFooter>{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {trigger && <DrawerTrigger render={trigger as React.ReactElement} />}
      <DrawerContent side="bottom" className={className}>
        {(title || description) && (
          <DrawerHeader>
            {title && <DrawerTitle>{title}</DrawerTitle>}
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
        )}
        <DrawerBody>{children}</DrawerBody>
        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/60 bg-muted/40 px-4 py-4 pb-[calc(1rem+max(env(safe-area-inset-bottom),var(--tg-safe-bottom,0px)))]">
            {footer}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}
