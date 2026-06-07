/**
 * Stamp `purchase_nav` on fund investment legs by looking up Fintual NAV
 * on the entry's date. Only touches fund-typed legs whose name is mapped
 * in `ft:funds`. Stocks and unmapped funds pass through untouched.
 *
 * Used by:
 *   - POST /api/investments  (after expandInvestment)
 *   - POST /api/quick        (after expandInvestment in dry & write)
 *   - POST /api/funds/backfill (for entries that lack purchase_nav)
 */
import { redis, KEYS } from "./redis"
import { getFintualNavOn } from "./fintual"
import { getYahooClose } from "./yahoo"
import type { Investment } from "@/types"

export async function stampNavs(legs: Investment[]): Promise<Investment[]> {
  const [funds, tickers] = await Promise.all([
    redis.get<Record<string, string>>(KEYS.funds),
    redis.get<Record<string, string>>(KEYS.tickers),
  ])
  const fundMap = new Map<string, string>()
  Object.entries(funds ?? {}).forEach(([n, f]) => fundMap.set(n.toLowerCase(), f))
  const tickerMap = new Map<string, string>()
  Object.entries(tickers ?? {}).forEach(([n, t]) => tickerMap.set(n.toLowerCase(), t))

  return Promise.all(
    legs.map(async leg => {
      // Funds → purchase_nav (MXN per share)
      if (leg.inv_type === "fund" && typeof leg.purchase_nav !== "number") {
        const fund = fundMap.get(leg.name.toLowerCase())
        if (fund) {
          const q = await getFintualNavOn(fund, leg.date)
          if (q) return { ...leg, purchase_nav: q.nav }
        }
        return leg
      }
      // Stocks → purchase_price (USD per share)
      if (leg.inv_type === "stock" && typeof leg.purchase_price !== "number") {
        const ticker = tickerMap.get(leg.name.toLowerCase())
        if (ticker) {
          const q = await getYahooClose(ticker, leg.date)
          if (q) return { ...leg, purchase_price: q.price }
        }
        return leg
      }
      return leg
    })
  )
}

