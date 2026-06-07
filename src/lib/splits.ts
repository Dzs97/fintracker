/**
 * Investment auto-split rules.
 * Stored in Redis under KEYS.splits as Record<sourceName, SplitLeg[]>.
 *
 * Lookup is case-insensitive on the source name — so "Fintual",
 * "fintual", "FINTUAL" all match the same rule.
 */
import { redis, KEYS } from "./redis"
import type { Investment, InvType } from "@/types"
import { nanoid } from "./utils"

export interface SplitLeg {
  name: string
  weight: number          // 0..1, must sum to <= 1 across legs
  inv_type?: InvType      // override fund/stock; defaults to source's type
}

export async function getSplits(): Promise<Record<string, SplitLeg[]>> {
  return (await redis.get<Record<string, SplitLeg[]>>(KEYS.splits)) ?? {}
}

export async function setSplits(splits: Record<string, SplitLeg[]>) {
  await redis.set(KEYS.splits, splits)
}

/**
 * Given a base investment, return the list of entries it should expand
 * into. If no rule matches, returns [base] unchanged (with id assigned).
 *
 * The base must already have an id; this fn assigns fresh ids to leg
 * copies so each leg is a distinct record. Amounts are weight*amount,
 * rounded to 2 decimals; the final leg absorbs any remainder so the
 * total exactly matches the original amount.
 */
export function expandInvestment(
  base: Omit<Investment, "id"> & { id?: string },
  splits: Record<string, SplitLeg[]>,
): Investment[] {
  // Case-insensitive lookup
  const key = Object.keys(splits).find(k => k.toLowerCase() === base.name.toLowerCase())
  const legs = key ? splits[key] : undefined
  if (!legs || legs.length === 0) {
    return [{ ...base, id: base.id ?? nanoid() } as Investment]
  }
  const out: Investment[] = []
  let assigned = 0
  legs.forEach((leg, i) => {
    const isLast = i === legs.length - 1
    const raw = base.amount * leg.weight
    const amt = isLast ? +(base.amount - assigned).toFixed(2) : +raw.toFixed(2)
    assigned += amt
    out.push({
      ...base,
      id: nanoid(),
      name: leg.name,
      amount: amt,
      inv_type: leg.inv_type ?? base.inv_type,
    } as Investment)
  })
  return out
}
