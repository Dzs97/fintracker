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
  learnedCats: "ft:learnedCats",   // Record<lowercase-keyword, Category>
                                   //   updated whenever the user submits an expense/CC entry —
                                   //   the entry name becomes a keyword that maps to its category.
  cardConfig:  "ft:cardConfig",    // Record<card, { cutoffDay, dueDay }> — day-of-month for
                                   //   statement cutoff and payment due. If dueDay < cutoffDay,
                                   //   the due date falls in the following month.
  statements:  "ft:statements",    // Statement[] — per-card per-period bank statements with
                                   //   closingBalance (authoritative) and cumulative paid.
  recurring:   "ft:recurring",     // Recurring[] — monthly auto-fire templates (Netflix, Telmex,
                                   //   gym, salary, etc.) processed by the daily cron.
  obligations: "ft:obligations",   // FutureObligation[] — locked-in MSI / financing tail
                                   //   per card (IKEA 4 more @ X/mo, etc.), used by forecast UI.
  backupIdx:   "ft:backup:idx",    // string[] — list of dates (YYYY-MM-DD) of stored snapshots,
                                   //   rotated to keep the most recent N. Each snapshot is at
                                   //   `ft:backup:<date>`.
  oblLastDec:  "ft:obligationsLastDec",  // Record<card, "YYYY-MM"> — last cycle period for which
                                         //   each card's obligations were auto-decremented.
                                         //   Prevents the daily cron from over-decrementing.
}
