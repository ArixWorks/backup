import { AuthForm } from "@/components/auth/auth-form"

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-background px-4 py-10">
      {/* subtle radial glow behind the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 35%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 70%)",
        }}
      />
      <div className="relative z-10 flex w-full justify-center">
        <AuthForm />
      </div>
    </main>
  )
}
