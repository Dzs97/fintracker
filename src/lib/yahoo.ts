/**
 * Yahoo Finance unofficial chart endpoint.
 * No API key, no signup. Reasonable for personal use.
 *
 * Returns the most recent regular-market price in USD (or whatever the
 * listing's native currency is — for most US tickers that's USD).
 */
export interface Quote {
  ticker: string
  price: number
  currency: string
  updatedAt: string
}

/**
 * Historical close price for a specific date (YYYY-MM-DD).
 * Walks back up to 7 days for weekend/holiday buys.
 */
export async function getYahooClose(ticker: string, date: string): Promise<{ price: number; date: string; currency: string } | null> {
  // Request a 14-day window ending on `date` so we have plenty of candidates
  const end = new Date(date + "T16:00:00-04:00")              // 4pm ET-ish
  const start = new Date(end.getTime() - 14 * 86400000)
  const p1 = Math.floor(start.getTime() / 1000)
  const p2 = Math.floor(end.getTime() / 1000)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${p1}&period2=${p2}&interval=1d`
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (FinTracker)" },
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    const ts: number[] | undefined = result?.timestamp
    const closes: Array<number | null> | undefined = result?.indicators?.quote?.[0]?.close
    const currency = result?.meta?.currency ?? "USD"
    if (!ts || !closes || ts.length === 0) return null
    // Find the latest entry on or before the requested date
    const target = new Date(date + "T23:59:59Z").getTime() / 1000
    for (let i = ts.length - 1; i >= 0; i--) {
      if (ts[i] <= target && typeof closes[i] === "number") {
        return {
          price: closes[i] as number,
          date: new Date(ts[i] * 1000).toISOString().split("T")[0],
          currency,
        }
      }
    }
    return null
  } catch {
    return null
  }
}

export async function getYahooQuote(ticker: string): Promise<Quote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`
    const res = await fetch(url, {
      // Yahoo blocks the default `node-fetch` UA from edge runtimes sometimes
      headers: { "User-Agent": "Mozilla/5.0 (FinTracker; +https://fintracker-rosy.vercel.app)" },
      // Cache at the edge for 60s so 5 quick refreshes don't hammer Yahoo
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    const json = await res.json()
    const meta = json?.chart?.result?.[0]?.meta
    if (!meta) return null
    const price = meta.regularMarketPrice ?? meta.previousClose
    if (typeof price !== "number") return null
    return {
      ticker: meta.symbol ?? ticker,
      price,
      currency: meta.currency ?? "USD",
      updatedAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}
