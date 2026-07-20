import { BookOpen } from "lucide-react"
import Link from "next/link"
import { currentUserId } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/page-header"
import { EmptyState, SignInRequired } from "@/components/empty-state"

export const metadata = {
  title: "آموزش‌های خریداری‌شده",
  robots: { index: false, follow: false },
}

export default async function TutorialsPage() {
  const userId = await currentUserId()
  if (!userId) return <SignInRequired description="برای مشاهده آموزش‌های خریداری‌شده وارد حساب شوید." />

  const tutorials = await prisma.content.findMany({
    where: {
      type: "tutorial",
      status: "PUBLISHED",
      attachedToDeliveries: { some: { status: "DELIVERED", order: { userId } } },
    },
    orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, excerpt: true, slug: true },
  })

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BookOpen}
        title="آموزش‌های خریداری‌شده"
        description="فقط آموزش‌های متصل به سفارش‌های تحویل‌شده شما نمایش داده می‌شوند."
      />
      {tutorials.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="هنوز آموزشی در دسترس نیست"
          description="پس از تحویل سفارش، آموزش مرتبط از این بخش و صفحه سفارش‌ها قابل مشاهده است."
          actionLabel="مشاهده سفارش‌ها"
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
