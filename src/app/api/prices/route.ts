import { NextRequest, NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"
import { redis, KEYS } from "@/lib/redis"
import { getYahooQuote } from "@/lib/yahoo"

/**
 * GET  /api/prices                 → list ticker map + cached quotes
 * GET  /api/prices?ticker=NU       → fetch one (uses 60s edge cache)
 * POST /api/prices                 → refresh ALL known tickers, write
 *                                    state.prices[name] for each mapped asset
 * PUT  /api/prices  { name, ticker }   → set/clear ticker for an asset
 *                                       (ticker="" removes the mapping)
 */
export async function GET(req: NextRequest) {
  const ticker = new URL(req.url).searchParams.get("ticker")
  if (ticker) {
    const q = await getYahooQuote(ticker.toUpperCase())
    if (!q) return NextResponse.json({ error: "not found" }, { status: 404 })
    return NextResponse.json(q)
  }
  const tickers = (await redis.get<Record<string, string>>(KEYS.tickers)) ?? {}
  return NextResponse.json({ tickers })
}

export async function POST() {
  const tickers = (await redis.get<Record<string, string>>(KEYS.tickers)) ?? {}
  const state = await getState()
  const prices = { ...state.prices }
  const results: Array<{ name: string; ticker: string; ok: boolean; price?: number }> = []

  // Refresh every mapped asset in parallel
  const quotes = await Promise.all(
    Object.entries(tickers).map(async ([name, ticker]) => {
      const q = await getYahooQuote(ticker)
      return { name, ticker, q }
    })
  )
  for (const { name, ticker, q } of quotes) {
    if (q) {
      prices[name] = { price: q.price, currency: q.currency, updatedAt: q.updatedAt }
      results.push({ name, ticker, ok: true, price: q.price })
    } else {
      results.push({ name, ticker, ok: false })
    }
  }
  await patchState({ prices })
  return NextResponse.json({ ok: true, results })
}

export async function PUT(req: NextRequest) {
  const { name, ticker } = await req.json()
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "missing name" }, { status: 400 })
  }
  const tickers = (await redis.get<Record<string, string>>(KEYS.tickers)) ?? {}
  if (!ticker) {
    delete tickers[name]
  } else {
    tickers[name] = String(ticker).toUpperCase()
  }
  await redis.set(KEYS.tickers, tickers)
  return NextResponse.json({ ok: true, tickers })
}
