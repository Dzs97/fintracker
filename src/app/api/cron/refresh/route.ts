import { NextRequest, NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"
import { redis, KEYS } from "@/lib/redis"
import { getYahooQuote } from "@/lib/yahoo"
import { getFintualPrice } from "@/lib/fintual"
import { computeCycle, type CardConfig } from "@/lib/cardCycles"
import { nanoid } from "@/lib/utils"
import type {
  Statement, Recurring, FutureObligation, Expense, Income, CCCharge, Investment,
} from "@/types"

/**
 * Daily cron. Performs in order:
 *   1) Refresh stock + fund prices (Yahoo + Fintual)
 *   2) Auto-create placeholder statements when a card has cut
 *   3) Fire recurring entries whose dayOfMonth has reached / passed
 *   4) Snapshot all state to ft:backup:<YYYY-MM-DD>, rotate to last 14
 *
 * Authorized by Bearer CRON_SECRET if set.
 */
async function refreshPrices(): Promise<Array<Record<string, unknown>>> {
  const tickers = (await redis.get<Record<string, string>>(KEYS.tickers)) ?? {}
  const funds   = (await redis.get<Record<string, string>>(KEYS.funds))   ?? {}
  const state = await getState()
  const prices = { ...state.prices }
  const log: Array<Record<string, unknown>> = []
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
  return log
}

function periodOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

async function autoCreateStatements(now: Date): Promise<Array<{ card: string; period: string }>> {
  const cfg = (await redis.get<Record<string, CardConfig>>(KEYS.cardConfig)) ?? {}
  const state = await getState()
  const list = state.statements ?? []
  const created: Array<{ card: string; period: string }> = []
  let dirty = false
  for (const [card, c] of Object.entries(cfg)) {
    const cycle = computeCycle(c, now)
    const period = periodOf(cycle.lastCutoff)
    const exists = list.some(s => s.card === card && s.period === period)
    if (!exists && now >= cycle.lastCutoff) {
      const placeholder: Statement = {
        id: nanoid(),
        card,
        period,
        closingBalance: 0,
        paid: 0,
        dueOn: cycle.statementDue.toISOString().split("T")[0],
        notes: "Auto-created at cutoff. Fill in closingBalance + pagoMinimo from your bank statement.",
      }
      list.push(placeholder)
      created.push({ card, period })
      dirty = true
    }
  }
  if (dirty) await patchState({ statements: list })
  return created
}

async function fireRecurring(now: Date): Promise<Array<{ name: string; type: string; amount: number }>> {
  const list = (await redis.get<Recurring[]>(KEYS.recurring)) ?? []
  if (list.length === 0) return []
  const thisPeriod = periodOf(now)
  const today = now.getDate()
  const fired: Array<{ name: string; type: string; amount: number }> = []
  const state = await getState()
  const expenses: Expense[] = [...state.expenses]
  const income: Income[] = [...state.income]
  const cc: CCCharge[] = [...state.cc]
  const investments: Investment[] = [...state.investments]
  const isoDate = now.toISOString().split("T")[0]
  let dirty = false
  const nextRecurring = list.map(r => {
    if (!r.active) return r
    if (r.lastFired === thisPeriod) return r
    const month = now.getMonth(), year = now.getFullYear()
    const lastDay = new Date(year, month + 1, 0).getDate()
    const targetDay = Math.min(r.dayOfMonth, lastDay)
    if (today < targetDay) return r
    // Fire it
    const base = { name: r.name, amount: r.amount, date: isoDate, note: r.note || "auto-recurring" }
    if (r.type === "expense") expenses.push({ id: nanoid(), ...base, cat: r.cat ?? "Other" })
    else if (r.type === "income") income.push({ id: nanoid(), ...base })
    else if (r.type === "cc")     cc.push({ id: nanoid(), ...base, cat: r.cat ?? "Other", card: (r.card ?? "OpenBank") as CCCharge["card"] })
    else if (r.type === "investment") investments.push({ id: nanoid(), ...base, gf: !!r.gf, inv_type: r.inv_type ?? "fund" })
    fired.push({ name: r.name, type: r.type, amount: r.amount })
    dirty = true
    return { ...r, lastFired: thisPeriod }
  })
  if (dirty) {
    await Promise.all([
      patchState({ expenses, income, cc, investments }),
      redis.set(KEYS.recurring, nextRecurring),
    ])
  }
  return fired
}

async function decrementObligations(now: Date): Promise<Array<{ card: string; period: string; decremented: number; removed: number }>> {
  const cfg = (await redis.get<Record<string, CardConfig>>(KEYS.cardConfig)) ?? {}
  if (Object.keys(cfg).length === 0) return []
  const obligations = (await redis.get<FutureObligation[]>(KEYS.obligations)) ?? []
  if (obligations.length === 0) return []
  const lastDec = (await redis.get<Record<string, string>>(KEYS.oblLastDec)) ?? {}
  const result: Array<{ card: string; period: string; decremented: number; removed: number }> = []
  // Decide per card whether we owe a decrement this cycle.
  // First-time-seen cards are RECORDED but NOT decremented — the user's
  // monthsRemaining is assumed to already exclude the just-closed cycle.
  // Only actual transitions to a NEW cycle trigger a tick.
  const cardsToTick = new Set<string>()
  let lastDecDirty = false
  for (const [card, c] of Object.entries(cfg)) {
    const cycle = computeCycle(c, now)
    const period = periodOf(cycle.lastCutoff)
    if (lastDec[card] === undefined) {
      // First sighting — seed lastDec without ticking
      lastDec[card] = period
      lastDecDirty = true
      continue
    }
    if (now >= cycle.lastCutoff && lastDec[card] !== period) {
      cardsToTick.add(card)
      lastDec[card] = period
      lastDecDirty = true
      result.push({ card, period, decremented: 0, removed: 0 })
    }
  }
  if (cardsToTick.size === 0) {
    // Persist lastDec for any first-time-seen cards
    if (lastDecDirty) await redis.set(KEYS.oblLastDec, lastDec)
    return []
  }
  const next: FutureObligation[] = []
  for (const o of obligations) {
    if (cardsToTick.has(o.card)) {
      const remaining = o.monthsRemaining - 1
      const entry = result.find(r => r.card === o.card)!
      entry.decremented += 1
      if (remaining > 0) {
        next.push({ ...o, monthsRemaining: remaining })
      } else {
        entry.removed += 1
      }
    } else {
      next.push(o)
    }
  }
  await Promise.all([
    redis.set(KEYS.obligations, next),
    redis.set(KEYS.oblLastDec, lastDec),
  ])
  return result
}

const MAX_BACKUPS = 14

async function snapshotBackup(now: Date): Promise<{ date: string; kept: number }> {
  const date = now.toISOString().split("T")[0]
  const state = await getState()
  await redis.set(`ft:backup:${date}`, state)
  const idx = (await redis.get<string[]>(KEYS.backupIdx)) ?? []
  // Dedupe and prepend
  const updated = [date, ...idx.filter(d => d !== date)]
  // Trim
  const keep = updated.slice(0, MAX_BACKUPS)
  const drop = updated.slice(MAX_BACKUPS)
  await Promise.all([
    redis.set(KEYS.backupIdx, keep),
    ...drop.map(d => redis.del(`ft:backup:${d}`)),
  ])
  return { date, kept: keep.length }
}

function authorized(req: NextRequest) {
  const want = process.env.CRON_SECRET
  if (!want) return true
  const got = req.headers.get("authorization") ?? ""
  return got === `Bearer ${want}`
}

async function run() {
  const now = new Date()
  const [prices, newStatements, decremented, fired, backup] = await Promise.all([
    refreshPrices(),
    autoCreateStatements(now),
    decrementObligations(now),
    fireRecurring(now),
    snapshotBackup(now),
  ])
  return {
    ok: true,
    ranAt: now.toISOString(),
    prices,
    autoCreatedStatements: newStatements,
    obligationsDecremented: decremented,
    recurringFired: fired,
    backup,
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  return NextResponse.json(await run())
}
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  return NextResponse.json(await run())
}
