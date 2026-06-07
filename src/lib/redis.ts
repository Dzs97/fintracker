import { Redis } from "@upstash/redis"

// Accept either the manual naming (UPSTASH_REDIS_REST_*) or the Vercel
// Upstash/KV marketplace integration naming (KV_REST_API_*).
const url   = process.env.UPSTASH_REDIS_REST_URL   ?? process.env.KV_REST_API_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN

export const redis = new Redis({ url: url!, token: token! })

export const KEYS = {
  expenses:    "ft:expenses",
  income:      "ft:income",
  cc:          "ft:cc",
  investments: "ft:investments",
  settled:     "ft:settled",
  prices:      "ft:prices",
  budgets:     "ft:budgets",
  fxRate:      "ft:fxRate",
  fxUpdatedAt: "ft:fxUpdatedAt",
  tickers:     "ft:tickers",       // Record<assetName, ticker> e.g. { Nubank: "NU" }
  priceCache:  "ft:priceCache",    // Record<ticker, { price, updatedAt }>  (short TTL)
  funds:       "ft:funds",         // Record<assetName, fundName>  e.g. { "Risky Hayek": "Risky Hayek" }
  splits:      "ft:splits",        // Record<srcName, Array<{name, weight, inv_type?}>>
                                   //   e.g. { Fintual: [{name:"Risky Hayek", weight:0.75, inv_type:"fund"}, ...] }
}
