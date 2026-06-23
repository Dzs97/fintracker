import { NextResponse } from "next/server"
import { getState } from "@/lib/state"
import { redis, KEYS } from "@/lib/redis"
import { getFxRate } from "@/lib/fx"
import { applyFxConfig, getFxConfig } from "@/lib/fxConfig"
import type { CardConfig } from "@/lib/cardCycles"
import type { Recurring, FutureObligation, Account, Goal } from "@/types"
import type { SplitLeg } from "@/lib/splits"

/**
 * GET /api/state — everything the dashboard needs in ONE round trip.
 * Replaces the 11-request fan-out the client used to do on every load.
 * All reads run in parallel server-side where latency to Upstash is ~1ms.
 */
export async function GET() {
  const [state, tickers, funds, splits, cardConfig, recurring, obligations, accounts, goals, baseRate, fxCfg] =
    await Promise.all([
      getState(),
      redis.get<Record<string, string>>(KEYS.tickers),
      redis.get<Record<string, string>>(KEYS.funds),
      redis.get<Record<string, SplitLeg[]>>(KEYS.splits),
      redis.get<Record<string, CardConfig>>(KEYS.cardConfig),
      redis.get<Recurring[]>(KEYS.recurring),
      redis.get<FutureObligation[]>(KEYS.obligations),
      redis.get<Account[]>(KEYS.accounts),
      redis.get<Goal[]>(KEYS.goals),
      getFxRate(),
      getFxConfig(),
    ])
  const { rate, source } = applyFxConfig(baseRate, fxCfg)
  return NextResponse.json({
    state: { ...state, fxRate: rate },
    fx: { rate, baseRate, source },
    tickers:     tickers     ?? {},
    funds:       funds       ?? {},
    splits:      splits      ?? {},
    cardConfig:  cardConfig  ?? {},
    recurring:   recurring   ?? [],
    obligations: obligations ?? [],
    accounts:    accounts    ?? [],
    goals:       goals       ?? [],
  })
}
