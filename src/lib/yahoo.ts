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
