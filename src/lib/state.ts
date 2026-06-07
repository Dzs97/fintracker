import { redis, KEYS } from "./redis"
import type { AppState } from "@/types"

export async function getState(): Promise<AppState> {
  const [expenses, income, cc, investments, settled, prices, budgets, fxRate] =
    await Promise.all([
      redis.get<AppState["expenses"]>(KEYS.expenses),
      redis.get<AppState["income"]>(KEYS.income),
      redis.get<AppState["cc"]>(KEYS.cc),
      redis.get<AppState["investments"]>(KEYS.investments),
      redis.get<AppState["settled"]>(KEYS.settled),
      redis.get<AppState["prices"]>(KEYS.prices),
      redis.get<AppState["budgets"]>(KEYS.budgets),
      redis.get<number>(KEYS.fxRate),
    ])
  return {
    expenses:    expenses    ?? [],
    income:      income      ?? [],
    cc:          cc          ?? [],
    investments: investments ?? [],
    settled:     settled     ?? {},
    prices:      prices      ?? {},
    budgets:     budgets     ?? [],
    fxRate:      fxRate      ?? 17.3,
  }
}

export async function patchState(patch: Partial<AppState>) {
  const ops: Promise<unknown>[] = []
  if (patch.expenses    !== undefined) ops.push(redis.set(KEYS.expenses,    patch.expenses))
  if (patch.income      !== undefined) ops.push(redis.set(KEYS.income,      patch.income))
  if (patch.cc          !== undefined) ops.push(redis.set(KEYS.cc,          patch.cc))
  if (patch.investments !== undefined) ops.push(redis.set(KEYS.investments, patch.investments))
  if (patch.settled     !== undefined) ops.push(redis.set(KEYS.settled,     patch.settled))
  if (patch.prices      !== undefined) ops.push(redis.set(KEYS.prices,      patch.prices))
  if (patch.budgets     !== undefined) ops.push(redis.set(KEYS.budgets,     patch.budgets))
  if (patch.fxRate      !== undefined) ops.push(redis.set(KEYS.fxRate,      patch.fxRate))
  await Promise.all(ops)
}
