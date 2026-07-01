"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckIcon, InfoIcon, TriangleAlertIcon, XIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <span className="cn-toast-badge" data-badge="success">
            <CheckIcon className="size-4" strokeWidth={3} />
          </span>
        ),
        info: (
          <span className="cn-toast-badge" data-badge="info">
            <InfoIcon className="size-4" strokeWidth={2.5} />
          </span>
        ),
        warning: (
          <span className="cn-toast-badge" data-badge="warning">
            <TriangleAlertIcon className="size-4" strokeWidth={2.5} />
          </span>
        ),
        error: (
          <span className="cn-toast-badge" data-badge="error">
            <XIcon className="size-4" strokeWidth={3} />
          </span>
        ),
        loading: (
          <span className="cn-toast-badge" data-badge="loading">
            <Loader2Icon className="size-4 animate-spin" strokeWidth={2.5} />
          </span>
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
