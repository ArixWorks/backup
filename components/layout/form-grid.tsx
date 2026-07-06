import { cn } from "@/lib/utils"

/**
 * Responsive form layout primitive.
 *
 *  - Mobile:  single column (fields stack full-width, easiest to fill on phones).
 *  - Tablet:  two columns (md).
 *  - Desktop: three columns (xl) for dense admin/editor forms.
 *
 * Fields that need more room use `<FormField span="full" | 2>` to span columns.
 * Column counts adapt to the container width, so the same form reads well from
 * a Telegram webview to a 2560px monitor without bespoke layouts.
 */
export function FormGrid({
  columns = 3,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { columns?: 2 | 3 }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 [gap:var(--space-fluid-sm)] md:grid-cols-2",
        columns === 3 && "xl:grid-cols-3",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

const SPAN_CLASS: Record<string, string> = {
  "1": "",
  "2": "md:col-span-2",
  full: "col-span-full",
}

export function FormField({
  span = "1",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { span?: "1" | "2" | "full" }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", SPAN_CLASS[span], className)} {...props}>
      {children}
    </div>
  )
}
