import { Suspense } from "react"
import { AuthForm } from "@/components/auth/auth-form"

// AuthForm reads `useSearchParams()` (?next=), which requires a Suspense
// boundary during prerender under the App Router.
export const dynamic = "force-dynamic"

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  )
}
