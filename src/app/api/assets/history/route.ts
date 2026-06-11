import { NextRequest, NextResponse } from "next/server"
import { redis, KEYS } from "@/lib/redis"
import { getYahooHistory } from "@/lib/yahoo"
import { getFintualHistory } from "@/lib/fintual"

/**
 * GET /api/assets/history?name=Nubank
 * Resolves the asset name against the ticker map (stocks → Yahoo, USD)
 * or the fund map (funds → Fintual, MXN) and returns ~6 months of daily
 * prices: { series: [{ date, price }], currency, source }.
 */
export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get("name")
  if (!name) return NextResponse.json({ error: "missing name" }, { status: 400 })

  const [tickers, funds] = await Promise.all([
    redis.get<Record<string, string>>(KEYS.tickers),
    redis.get<Record<string, string>>(KEYS.funds),
  ])
  const tickerEntry = Object.entries(tickers ?? {}).find(([n]) => n.toLowerCase() === name.toLowerCase())
  if (tickerEntry) {
    const series = await getYahooHistory(tickerEntry[1])
    if (!series) return NextResponse.json({ error: "history unavailable" }, { status: 404 })
    return NextResponse.json({ series, currency: "USD", source: `Yahoo · ${tickerEntry[1]}` })
  }
  const fundEntry = Object.entries(funds ?? {}).find(([n]) => n.toLowerCase() === name.toLowerCase())
  if (fundEntry) {
    const series = await getFintualHistory(fundEntry[1])
    if (!series) return NextResponse.json({ error: "history unavailable" }, { status: 404 })
    return NextResponse.json({ series, currency: "MXN", source: `Fintual · ${fundEntry[1]}` })
  }
  return NextResponse.json({ error: "asset not mapped" }, { status: 404 })
}
