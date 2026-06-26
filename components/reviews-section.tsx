"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { fetcher, apiPost, apiDelete, ApiError } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
import { StarRating } from "@/components/star-rating"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"

interface ReviewView {
  id: string
  rating: number
  comment: string | null
  authorName: string
  createdAt: string
  mine: boolean
}

interface ReviewsResponse {
  data: {
    summary: {
      average: number | null
      count: number
      distribution: [number, number, number, number, number]
    }
    reviews: ReviewView[]
    eligible: boolean
    mine: { id: string; rating: number; comment: string | null } | null
  }
}

export function ReviewsSection({ productId }: { productId: string }) {
  const { t, num, dir, locale } = useI18n()
  const { data, isLoading, mutate } = useSWR<ReviewsResponse>(
    `/api/v1/flash-sales/${productId}/reviews`,
    fetcher,
  )

  const d = data?.data
  const summary = d?.summary
  const eligible = d?.eligible ?? false
  const mine = d?.mine ?? null

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const startEditing = () => {
    setRating(mine?.rating ?? 0)
    setComment(mine?.comment ?? "")
    setOpen(true)
  }

  const submit = async () => {
    if (rating < 1) return toast.error(t("reviews.yourRating"))
    setSubmitting(true)
    try {
      await apiPost(`/api/v1/flash-sales/${productId}/reviews`, { rating, comment: comment || undefined })
      toast.success(t("reviews.thanks"))
      setOpen(false)
      mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Error")
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async () => {
    setSubmitting(true)
    try {
      await apiDelete(`/api/v1/flash-sales/${productId}/reviews`)
      setOpen(false)
      mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Error")
    } finally {
      setSubmitting(false)
    }
  }

  const dateFmt = (iso: string) =>
    new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : locale, { dateStyle: "medium" }).format(
      new Date(iso),
    )

  return (
    <section className="space-y-4" dir={dir}>
      <h2 className="text-lg font-bold">{t("reviews.title")}</h2>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <>
          {/* Summary: average + distribution bars */}
          {summary && summary.count > 0 && (
            <div className="flex flex-col gap-4 rounded-2xl border border-border p-4 sm:flex-row sm:items-center">
              <div className="flex flex-col items-center gap-1 sm:w-32">
                <span className="text-4xl font-extrabold tabular-nums">
                  {num(Math.round((summary.average ?? 0) * 10) / 10)}
                </span>
                <StarRating value={summary.average ?? 0} size={16} />
                <span className="text-xs text-muted-foreground">
                  {num(summary.count)} {t("reviews.ratingsCount")}
                </span>
              </div>
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const c = summary.distribution[star - 1]
                  const pct = summary.count > 0 ? (c / summary.count) * 100 : 0
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="w-3 text-xs tabular-nums text-muted-foreground">{num(star)}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-end text-xs tabular-nums text-muted-foreground">
                        {num(c)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Write / edit form (only for buyers) */}
          {eligible ? (
            open ? (
              <div className="space-y-3 rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t("reviews.yourRating")}</span>
                  <StarRating value={rating} onChange={setRating} size={24} />
                </div>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t("reviews.commentPlaceholder")}
                  maxLength={1000}
                  rows={3}
                />
                <div className="flex items-center gap-2">
                  <Button onClick={submit} disabled={submitting || rating < 1}>
                    {t("reviews.submit")}
                  </Button>
                  <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
                    {t("common.cancel")}
                  </Button>
                  {mine && (
                    <Button
                      variant="ghost"
                      onClick={remove}
                      disabled={submitting}
                      className="ms-auto text-destructive hover:text-destructive"
                    >
                      {t("reviews.delete")}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={startEditing} className="w-full sm:w-auto">
                {mine ? t("reviews.edit") : t("reviews.write")}
              </Button>
            )
          ) : null}

          {/* Review list */}
          {d && d.reviews.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t("reviews.empty")}
            </p>
          ) : (
            <ul className="space-y-3">
              {d?.reviews.map((r) => (
                <li key={r.id} className="space-y-1.5 rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {r.mine ? t("reviews.you") : r.authorName}
                    </span>
                    <span className="text-xs text-muted-foreground">{dateFmt(r.createdAt)}</span>
                  </div>
                  <StarRating value={r.rating} size={14} />
                  {r.comment && <p className="text-sm leading-relaxed text-foreground/90">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}

          {!eligible && d && (
            <p className="text-center text-xs text-muted-foreground">{t("reviews.mustBuy")}</p>
          )}
        </>
      )}
    </section>
  )
}
