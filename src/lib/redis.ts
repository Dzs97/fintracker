import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Key schema
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
}
