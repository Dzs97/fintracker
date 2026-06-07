#!/usr/bin/env node
/**
 * Migration script — seeds your current tracker data into Redis
 * Run once after deploying:  npx tsx scripts/migrate.ts
 *
 * This contains the exact data from your claude.ai artifact as of Jun 4 2026.
 * After running, your Vercel app will have all your history intact.
 */

import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { Redis } from "@upstash/redis"
import { KEYS } from "../src/lib/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const data = {
  expenses: [
    { id: "seed-exp-001", name: "Card payment",  amount: 5416, cat: "Card Payments", date: "2026-06-03", note: "OpenBank" },
    { id: "seed-exp-002", name: "Coffee",         amount: 150,  cat: "Food & Dining", date: "2026-06-04", note: "DolarApp" },
  ],

  income: [
    { id: "seed-inc-001", name: "Treeline", amount: 625, date: "2026-06-03", note: "" },
  ],

  cc: [
    { id: "seed-cc-001", name: "Sakura Arena de gato", amount: 637,  date: "2026-06-01", cat: "Pets",          card: "OpenBank", installments: 1 },
    { id: "seed-cc-002", name: "UberEats",              amount: 436,  date: "2026-06-02", cat: "Food & Dining", card: "OpenBank", installments: 1 },
    { id: "seed-cc-003", name: "UberEats",              amount: 247,  date: "2026-06-02", cat: "Food & Dining", card: "OpenBank", installments: 1 },
    { id: "seed-cc-004", name: "SuMesa Super",          amount: 868,  date: "2026-06-03", cat: "Groceries",     card: "OpenBank", installments: 1 },
    { id: "seed-cc-005", name: "UberEats",              amount: 503,  date: "2026-06-03", cat: "Food & Dining", card: "OpenBank", installments: 1 },
    { id: "seed-cc-006", name: "UberEats",              amount: 294,  date: "2026-06-03", cat: "Food & Dining", card: "OpenBank", installments: 1 },
    { id: "seed-cc-007", name: "Nagaoka",               amount: 746,  date: "2026-06-04", cat: "Food & Dining", card: "Amex",     installments: 1 },
    { id: "seed-cc-008", name: "Amazon",                amount: 178,  date: "2026-06-04", cat: "Shopping",      card: "Amex",     installments: 1 },
    { id: "seed-cc-009", name: "Uber",                  amount: 130,  date: "2026-06-04", cat: "Transport",     card: "OpenBank", installments: 1 },
    { id: "seed-cc-010", name: "Uber",                  amount: 105,  date: "2026-06-04", cat: "Transport",     card: "OpenBank", installments: 1 },
    { id: "seed-cc-011", name: "UberEats",              amount: 782,  date: "2026-06-04", cat: "Food & Dining", card: "OpenBank", installments: 1 },
  ],

  investments: [
    { id: "seed-inv-001", name: "Fintual", amount: 1500, date: "2026-06-01", note: "",               gf: false, inv_type: "fund",  historical: true  },
    { id: "seed-inv-002", name: "Fintual", amount: 500,  date: "2026-06-01", note: "",               gf: true,  inv_type: "fund",  historical: true  },
    { id: "seed-inv-003", name: "Nubank",  amount: 1000, date: "2026-06-03", note: "",               gf: true,  inv_type: "stock", purchase_price: 11.64 },
    { id: "seed-inv-004", name: "Fintual", amount: 1500, date: "2026-06-03", note: "",               gf: false, inv_type: "fund",  historical: false },
    { id: "seed-inv-005", name: "Nubank",  amount: 750,  date: "2026-06-04", note: "",               gf: false, inv_type: "stock", purchase_price: 11.64 },
  ],

  settled: {},

  prices: {
    Nubank: { price: 11.64, currency: "USD", updatedAt: "2026-06-03T00:00:00.000Z" },
  },

  budgets: [],

  fxRate: 17.3,
}

async function migrate() {
  console.log("🔄 Starting migration to Redis...\n")

  await Promise.all([
    redis.set(KEYS.expenses,    data.expenses),
    redis.set(KEYS.income,      data.income),
    redis.set(KEYS.cc,          data.cc),
    redis.set(KEYS.investments, data.investments),
    redis.set(KEYS.settled,     data.settled),
    redis.set(KEYS.prices,      data.prices),
    redis.set(KEYS.budgets,     data.budgets),
    redis.set(KEYS.fxRate,      data.fxRate),
  ])

  console.log("✅ expenses:    ", data.expenses.length, "entries")
  console.log("✅ income:      ", data.income.length, "entries")
  console.log("✅ cc charges:  ", data.cc.length, "entries")
  console.log("✅ investments: ", data.investments.length, "entries")
  console.log("✅ prices:      ", Object.keys(data.prices).join(", "))
  console.log("✅ fx rate:     ", data.fxRate)
  console.log("\n🎉 Migration complete. Your data is live in Redis.")
  console.log("   Deploy to Vercel and you're good to go.")
}

migrate().catch(err => { console.error("❌ Migration failed:", err); process.exit(1) })
