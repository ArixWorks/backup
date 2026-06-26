"use client"

import useSWR from "swr"
import { apiGet } from "@/lib/api-client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatMoney } from "@/lib/format"
import { CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck, Scale } from "lucide-react"

interface ZeroSumResult {
  currency: string
  balanced: boolean
  residual: string
}
interface WalletMismatch {
  userId: string
  displayName: string | null
  currency: string
  ledgerTotal: string
  ledgerFrozen: string
  walletTotal: string
  walletFrozen: string
  totalDiff: string
  frozenDiff: string
}
interface ReconciliationReport {
  ranAt: string
  currencies: string[]
  zeroSum: ZeroSumResult[]
  walletsChecked: number
  mismatches: WalletMismatch[]
  ok: boolean
}

const fetcher = (url: string) => apiGet<{ data: ReconciliationReport }>(url)

export default function ReconciliationPage() {
  const { data: envelope, error, isLoading, mutate, isValidating } = useSWR(
    "/api/v1/admin/finance/reconciliation",
    fetcher,
    { revalidateOnFocus: false },
  )
  const data = envelope?.data

  const run = async () => {
    await mutate()
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Scale className="h-6 w-6 text-primary" />
            مغایرت‌گیری و حسابرسی
          </h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            موجودی هر کاربر از روی دفترکل دوطرفه بازسازی و با موجودی ذخیره‌شده مقایسه می‌شود.
          </p>
        </div>
        <Button onClick={run} disabled={isValidating} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
          اجرای مجدد
        </Button>
      </header>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          خطا در اجرای مغایرت‌گیری. دوباره تلاش کنید.
        </Card>
      )}

      {isLoading && !data && (
        <Card className="p-6 text-center text-sm text-muted-foreground">در حال محاسبه…</Card>
      )}

      {data && (
        <>
          {/* Overall health banner */}
          <Card
            className={`flex items-center gap-3 p-5 ${
              data.ok
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-destructive/40 bg-destructive/5"
            }`}
          >
            {data.ok ? (
              <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-8 w-8 shrink-0 text-destructive" />
            )}
            <div>
              <p className={`font-semibold ${data.ok ? "text-emerald-600" : "text-destructive"}`}>
                {data.ok ? "همه‌چیز تراز است" : "مغایرت یافت شد"}
              </p>
              <p className="text-sm text-muted-foreground">
                {data.walletsChecked.toLocaleString("fa-IR")} کیف‌پول بررسی شد ·{" "}
                {new Date(data.ranAt).toLocaleString("fa-IR")}
              </p>
            </div>
          </Card>

          {/* Zero-sum checks per currency */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" />
              تراز دفترکل (مجموع صفر)
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.zeroSum.map((z) => (
                <Card key={z.currency} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-foreground">{z.currency}</p>
                    <p className="text-xs text-muted-foreground">
                      باقی‌مانده: {formatMoney(z.residual)}
                    </p>
                  </div>
                  {z.balanced ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600">تراز</Badge>
                  ) : (
                    <Badge variant="destructive">نامتوازن</Badge>
                  )}
                </Card>
              ))}
            </div>
          </section>

          {/* Wallet mismatches */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              مغایرت کیف‌پول‌ها{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({data.mismatches.length.toLocaleString("fa-IR")})
              </span>
            </h2>
            {data.mismatches.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                هیچ مغایرتی بین دفترکل و موجودی ذخیره‌شده وجود ندارد.
              </Card>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[640px] text-right text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">کاربر</th>
                      <th className="px-3 py-2 font-medium">ارز</th>
                      <th className="px-3 py-2 font-medium">دفترکل</th>
                      <th className="px-3 py-2 font-medium">کیف‌پول</th>
                      <th className="px-3 py-2 font-medium">اختلاف کل</th>
                      <th className="px-3 py-2 font-medium">اختلاف بلوکه</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.mismatches.map((m) => (
                      <tr key={`${m.userId}:${m.currency}`} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-foreground">
                          {m.displayName ?? m.userId.slice(0, 8)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{m.currency}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatMoney(m.ledgerTotal)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatMoney(m.walletTotal)}
                        </td>
                        <td className="px-3 py-2 font-medium text-destructive">
                          {formatMoney(m.totalDiff)}
                        </td>
                        <td className="px-3 py-2 font-medium text-destructive">
                          {formatMoney(m.frozenDiff)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
