import { NextRequest, NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"
import { getSplits, expandInvestment } from "@/lib/splits"
import { stampNavs } from "@/lib/stampNav"
import type { Investment } from "@/types"

export async function GET() {
  const state = await getState()
  return NextResponse.json({ investments: state.investments, prices: state.prices })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { _skipSplit, ...rest } = body
  const state = await getState()
  let legs: Investment[]
  if (_skipSplit) {
    // Restore path — preserve all original fields verbatim. Skip stamping
    // so existing purchase_price / purchase_nav round-trip unchanged.
    const splits = {}
    legs = expandInvestment(rest, splits)
  } else {
    const splits = await getSplits()
    legs = await stampNavs(expandInvestment(rest, splits))
  }
  await patchState({ investments: [...state.investments, ...legs] })
  return NextResponse.json(legs.length === 1 ? legs[0] : { ok: true, expanded: legs })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const state = await getState()
  await patchState({ investments: state.investments.filter((e: Investment) => e.id !== id) })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const { ticker, price } = await req.json()
  const state = await getState()
  await patchState({
    prices: { ...state.prices, [ticker]: { price, currency: "USD", updatedAt: new Date().toISOString() } },
  })
  return NextResponse.json({ ok: true })
}
