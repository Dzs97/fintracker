import { NextRequest, NextResponse } from "next/server"
import { getFintualPrice } from "@/lib/fintual"
import { getState, patchState } from "@/lib/state"

export async function GET(req: NextRequest) {
  const fund = new URL(req.url).searchParams.get("fund")
  if (!fund) return NextResponse.json({ error: "missing fund" }, { status: 400 })
  const result = await getFintualPrice(fund)
  return NextResponse.json(result ?? { error: "fund not found" })
}

export async function POST() {
  const state = await getState()
  const fundNames = Array.from(new Set(state.investments.filter(i => i.inv_type === "fund").map(i => i.name)))
  const updated = { ...state.prices }
  for (const name of fundNames) {
    const data = await getFintualPrice(name)
    if (data) updated[name] = { price: data.nav, currency: data.currency, updatedAt: data.updatedAt }
  }
  await patchState({ prices: updated })
  return NextResponse.json({ ok: true, updated: Object.keys(updated) })
}
