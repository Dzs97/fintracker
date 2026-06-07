import { NextRequest, NextResponse } from "next/server"
import { getYahooClose, getYahooQuote } from "@/lib/yahoo"

/**
 * GET /api/benchmark?symbol=^MXX&from=2026-06-01
 *   → { symbol, from, to, fromPrice, toPrice, pct }
 *
 * The "to" price is the latest close (uses real-time chart endpoint).
 * Used by the dashboard to overlay an index return next to portfolio P&L.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const symbol = url.searchParams.get("symbol") ?? ""
  const from   = url.searchParams.get("from")   ?? ""
  if (!symbol || !from) {
    return NextResponse.json({ error: "missing symbol or from" }, { status: 400 })
  }
  const [fromQuote, latest] = await Promise.all([
    getYahooClose(symbol, from),
    getYahooQuote(symbol),
  ])
  if (!fromQuote || !latest) {
    return NextResponse.json({ error: "lookup failed", symbol, from }, { status: 404 })
  }
  const pct = ((latest.price - fromQuote.price) / fromQuote.price) * 100
  return NextResponse.json({
    symbol: latest.ticker,
    from: fromQuote.date,
    to: new Date().toISOString().split("T")[0],
    fromPrice: fromQuote.price,
    toPrice: latest.price,
    pct,
  })
}
