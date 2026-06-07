import { NextRequest, NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"
import { redis, KEYS } from "@/lib/redis"
import { getFintualPrice } from "@/lib/fintual"

/**
 * GET  /api/funds                       → mapping + cached prices
 * GET  /api/funds?name=Risky+Hayek      → live NAV (10-min edge cache)
 * POST /api/funds                       → refresh ALL mapped funds, write state.prices[name]
 * PUT  /api/funds  { name, fund }       → set/clear fund mapping
 *
 * "fund" is the Fintual fund display name. For typical assets, set
 * name == fund (e.g. { name: "Risky Hayek", fund: "Risky Hayek" }).
 */
export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get("name")
  if (name) {
    const q = await getFintualPrice(name)
    if (!q) return NextResponse.json({ error: "not found" }, { status: 404 })
    return NextResponse.json(q)
  }
  const funds = (await redis.get<Record<string, string>>(KEYS.funds)) ?? {}
  return NextResponse.json({ funds })
}

export async function POST() {
  const funds = (await redis.get<Record<string, string>>(KEYS.funds)) ?? {}
  const state = await getState()
  const prices = { ...state.prices }
  const results: Array<{ name: string; fund: string; ok: boolean; nav?: number; asOf?: string }> = []

  const quotes = await Promise.all(
    Object.entries(funds).map(async ([name, fund]) => {
      const q = await getFintualPrice(fund)
      return { name, fund, q }
    })
  )
  for (const { name, fund, q } of quotes) {
    if (q) {
      prices[name] = { price: q.nav, currency: q.currency, updatedAt: q.updatedAt }
      results.push({ name, fund, ok: true, nav: q.nav, asOf: q.asOf })
    } else {
      results.push({ name, fund, ok: false })
    }
  }
  await patchState({ prices })
  return NextResponse.json({ ok: true, results })
}

export async function PUT(req: NextRequest) {
  const { name, fund } = await req.json()
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "missing name" }, { status: 400 })
  }
  const funds = (await redis.get<Record<string, string>>(KEYS.funds)) ?? {}
  if (!fund) {
    delete funds[name]
  } else {
    funds[name] = String(fund).trim()
  }
  await redis.set(KEYS.funds, funds)
  return NextResponse.json({ ok: true, funds })
}
