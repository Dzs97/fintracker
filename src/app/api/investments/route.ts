import { NextRequest, NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"
import { nanoid } from "@/lib/utils"
import type { Investment } from "@/types"

export async function GET() {
  const state = await getState()
  return NextResponse.json({ investments: state.investments, prices: state.prices })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const state = await getState()
  const entry: Investment = { id: nanoid(), ...body }
  await patchState({ investments: [...state.investments, entry] })
  return NextResponse.json(entry)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const state = await getState()
  await patchState({ investments: state.investments.filter(e => e.id !== id) })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const { ticker, price } = await req.json()
  const state = await getState()
  await patchState({
    prices: { ...state.prices, [ticker]: { price, currency: "USD", updatedAt: new Date().toISOString() } }
  })
  return NextResponse.json({ ok: true })
}
