"use client"

import { Receipt } from "lucide-react"
import { Card } from "@/components/ui/card"
import { formatNumber, formatToman } from "@/lib/format"
import type { OrderPaymentReport } from "@/lib/orders/shared"

const DISCOUNT_KIND_LABELS: Record<string, string> = {
  TIER: "تخفیف پلکانی/پلن",
  COUPON: "کد تخفیف",
}

/**
 * Accurate payment breakdown for an order — the admin's financial report:
 * original price, discount (kind + percent + coupon), cashback/bonus, referral
 * commission, net paid, and payment method. All values come from the immutable
 * snapshot/ledger via lib/core/order-report.
 */
export function PaymentReportCard({ report }: { report: OrderPaymentReport }) {
  const hasDiscount = report.discountAmount > 0
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-primary" />
        <h2 className="font-bold">گزارش پرداخت</h2>
        {report.derived && (
          <span
            className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            title="این سفارش پیش از افزودن اسنپ‌شات ثبت شده و ارقام تخفیف تخمینی است."
          >
            تخمینی
          </span>
        )}
      </div>

      <dl className="flex flex-col gap-2 text-sm">
        <ReportRow label="قیمت اصلی" value={`${formatToman(String(report.originalAmount))} تومان`} />

        {hasDiscount && (
          <ReportRow
            label={
              <span className="flex items-center gap-1.5">
                تخفیف
                <span className="rounded bg-success/10 px-1.5 py-0.5 text-[11px] font-medium text-success">
                  {report.discountKind ? DISCOUNT_KIND_LABELS[report.discountKind] ?? report.discountKind : "تخفیف"}
                  {report.discountPercent > 0 && ` · ${formatNumber(report.discountPercent)}٪`}
                </span>
              </span>
            }
            value={`− ${formatToman(String(report.discountAmount))} تومان`}
            valueClass="text-success"
          />
        )}

        {report.couponCode && (
          <ReportRow
            label="کد تخفیف استفاده‌شده"
            value={<span className="font-mono" dir="ltr">{report.couponCode}</span>}
          />
        )}

        <div className="my-1 border-t border-border" />

        <ReportRow
          label="مبلغ پرداخت‌شده (خالص)"
          value={`${formatToman(String(report.net))} تومان`}
          valueClass="font-bold"
          strong
        />
        <ReportRow
          label="روش پرداخت"
          value={report.paymentMethod === "WALLET" ? "کیف پول" : report.paymentMethod}
        />

        {report.cashback > 0 && (
          <ReportRow
            label="بونوس/کش‌بک به کاربر"
            value={`+ ${formatToman(String(report.cashback))} تومان`}
            valueClass="text-primary"
          />
        )}
        {report.commission > 0 && (
          <ReportRow
            label="پورسانت معرف"
            value={`${formatToman(String(report.commission))} تومان`}
            valueClass="text-muted-foreground"
          />
        )}
      </dl>
    </Card>
  )
}

function ReportRow({
  label,
  value,
  valueClass,
  strong,
}: {
  label: React.ReactNode
  value: React.ReactNode
  valueClass?: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</dt>
      <dd className={valueClass} dir="auto">
        {value}
      </dd>
    </div>
  )
}
