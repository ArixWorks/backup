import { BookOpen } from "lucide-react"
import Link from "next/link"
import { currentUserId } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/page-header"
import { EmptyState, SignInRequired } from "@/components/empty-state"
import { getRequestLocale, serverCopy } from "@/lib/i18n/server"
import { getLocalizedData } from "@/lib/i18n/content-translation"

export const metadata = {
  title: "آموزش‌های خریداری‌شده",
  robots: { index: false, follow: false },
}

export default async function TutorialsPage() {
  const [userId, locale] = await Promise.all([currentUserId(), getRequestLocale()])
  if (!userId) return <SignInRequired description={serverCopy("signInTutorials", locale)} />

  const sourceTutorials = await prisma.content.findMany({
    where: {
      type: "tutorial",
      status: "PUBLISHED",
      attachedToDeliveries: { some: { status: "DELIVERED", order: { userId } } },
    },
    orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, excerpt: true, slug: true },
  })
  const tutorials = await Promise.all(sourceTutorials.map(async (tutorial) => ({
    ...tutorial,
    ...(await getLocalizedData({
      entityType: "content:tutorial",
      entityId: tutorial.id,
      locale,
      fallback: { title: tutorial.title, excerpt: tutorial.excerpt },
    })),
  })))

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BookOpen}
        title={serverCopy("purchasedTutorials", locale)}
        description={serverCopy("purchasedTutorialsDescription", locale)}
      />
      {tutorials.length === 0 ? (
        <EmptyState
          iconName="bookOpen"
          title={serverCopy("noTutorials", locale)}
          description={serverCopy("noTutorialsDescription", locale)}
          actionLabel={serverCopy("viewOrders", locale)}
          actionHref="/orders"
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {tutorials.map((tutorial) => (
            <li key={tutorial.id}>
              <Link
                href={`/tutorials/${tutorial.slug}`}
                className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-bold">{tutorial.title}</h2>
                    {tutorial.excerpt && (
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {tutorial.excerpt}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
