import { route } from "@/lib/api/handler"
import { listCurrencies, getRate } from "@/lib/core/currencies"

export const dynamic = "force-dynamic"

/** Public list of active currencies plus the current rate matrix between them. */
export const GET = route(async () => {
  const currencies = await listCurrencies()
  const codes = currencies.map((c) => c.code)
  const rates: Array<{ from: string; to: string; rate: string }> = []
  for (const from of codes) {
    for (const to of codes) {
      if (from === to) continue
      const r = await getRate(from, to)
      if (r != null) rates.push({ from, to, rate: r.toString() })
    }
  }
  return { currencies, rates }
})
