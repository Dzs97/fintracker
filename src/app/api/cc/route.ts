import { NextRequest, NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"
import { nanoid } from "@/lib/utils"
import { recordLearned } from "@/lib/learnedCats"
import type { CCCharge, Expense } from "@/types"

export async function GET() {
  const state = await getState()
  return NextResponse.json({ cc: state.cc, settled: state.settled })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const state = await getState()
  const entry: CCCharge = { id: nanoid(), ...body }
  await patchState({ cc: [...state.cc, entry] })
  void recordLearned(entry.name, entry.cat)
  return NextResponse.json(entry)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const state = await getState()
  await patchState({ cc: state.cc.filter(e => e.id !== id) })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const state = await getState()

  // Edit path: body has { id, ...fields } → update the charge in place
  if (body.id) {
    const { id, ...fields } = body
    const next = state.cc.map(e => e.id === id ? { ...e, ...fields, id } : e)
    const updated = next.find(e => e.id === id)
    await patchState({ cc: next })
    if (updated) void recordLearned(updated.name, updated.cat)
    return NextResponse.json({ ok: true, entry: updated })
  }

  // Settle path (original behaviour): body has { card }
  const { card } = body
  const raw = state.cc.filter(e => e.card === card).reduce((s, e) => s + e.amount, 0)
  const pool = Math.max(0, raw - (state.settled[card] ?? 0))
  if (pool === 0) return NextResponse.json({ ok: true, pool: 0 })
  const payment: Expense = {
    id: nanoid(), name: `${card} statement`, amount: pool,
    cat: "Card Payments", date: new Date().toISOString().split("T")[0], note: "settled",
  }
  await patchState({
    settled: { ...state.settled, [card]: (state.settled[card] ?? 0) + pool },
    expenses: [...state.expenses, payment],
  })
  return NextResponse.json({ ok: true, pool, entry: payment })
}
