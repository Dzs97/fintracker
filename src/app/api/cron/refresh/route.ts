import { NextRequest, NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"
import { redis, KEYS } from "@/lib/redis"
import { getYahooQuote } from "@/lib/yahoo"
import { getFintualPrice } from "@/lib/fintual"

/**
 * Scheduled (vercel.json crons) and also manually callable:
 *   POST /api/cron/refresh
 *
 * Vercel cron requests carry `Authorization: Bearer <CRON_SECRET>` if you
 * set CRON_SECRET in env. We accept those, plus manual calls in dev.
 * Other callers are rejected if CRON_SECRET is set.
 */
async function run() {
  const tickers = (await redis.get<Record<string, string>>(KEYS.tickers)) ?? {}
  const funds   = (await redis.get<Record<string, string>>(KEYS.funds))   ?? {}
  const state = await getState()
  const prices = { ...state.prices }
  const log: Array<{ name: string; src: "yahoo" | "fintual"; ok: boolean; price?: number }> = []

  await Promise.all([
    ...Object.entries(tickers).map(async ([name, ticker]) => {
      const q = await getYahooQuote(ticker)
      if (q) { prices[name] = { price: q.price, currency: q.currency, updatedAt: q.updatedAt }; log.push({ name, src: "yahoo", ok: true, price: q.price }) }
      else { log.push({ name, src: "yahoo", ok: false }) }
    }),
    ...Object.entries(funds).map(async ([name, fund]) => {
      const q = await getFintualPrice(fund)
      if (q) { prices[name] = { price: q.nav, currency: q.currency, updatedAt: q.updatedAt }; log.push({ name, src: "fintual", ok: true, price: q.nav }) }
      else { log.push({ name, src: "fintual", ok: false }) }
    }),
  ])

  await patchState({ prices })
  return { ok: true, log, ranAt: new Date().toISOString() }
}

function authorized(req: NextRequest) {
  const want = process.env.CRON_SECRET
  if (!want) return true
  const got = req.headers.get("authorization") ?? ""
  return got === `Bearer ${want}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  return NextResponse.json(await run())
}
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  return NextResponse.json(await run())
}
