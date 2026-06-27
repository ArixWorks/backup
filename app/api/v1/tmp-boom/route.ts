import { route } from "@/lib/api/handler"

// TEMPORARY verification route — throws an unexpected error so we can confirm
// the error-tracking pipeline (handler -> captureError -> ErrorEvent + dedup).
export const GET = route(async () => {
  const obj: Record<string, unknown> = {}
  // Intentionally trigger a real runtime TypeError.
  // @ts-expect-error deliberate
  return obj.nonexistent.deep.access
})
