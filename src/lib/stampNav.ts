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
import type { Investment } from "@/types"

export async function stampNavs(legs: Investment[]): Promise<Investment[]> {
  const funds = (await redis.get<Record<string, string>>(KEYS.funds)) ?? {}
  if (Object.keys(funds).length === 0) return legs

  // Build a case-insensitive lookup of mapped fund names
  const map = new Map<string, string>()
  Object.entries(funds).forEach(([name, fund]) => map.set(name.toLowerCase(), fund))

  return Promise.all(
    legs.map(async leg => {
      if (leg.inv_type !== "fund") return leg
      if (typeof leg.purchase_nav === "number") return leg
      const fund = map.get(leg.name.toLowerCase())
      if (!fund) return leg
      const q = await getFintualNavOn(fund, leg.date)
      if (!q) return leg
      return { ...leg, purchase_nav: q.nav }
    })
  )
}
