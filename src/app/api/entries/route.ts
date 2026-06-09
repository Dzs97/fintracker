import { NextRequest, NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"
import { nanoid } from "@/lib/utils"
import { recordLearned } from "@/lib/learnedCats"
import type { Expense, Income } from "@/types"

export async function GET() {
  const state = await getState()
  return NextResponse.json({ expenses: state.expenses, income: state.income })
}

export async function POST(req: NextRequest) {
  const { type, ...body } = await req.json()
  const state = await getState()

  if (type === "expense") {
    const entry: Expense = { id: nanoid(), ...body }
    await patchState({ expenses: [...state.expenses, entry] })
    void recordLearned(entry.name, entry.cat)
    return NextResponse.json(entry)
  }
  if (type === "income") {
    const entry: Income = { id: nanoid(), ...body }
    await patchState({ income: [...state.income, entry] })
    return NextResponse.json(entry)
  }
  return NextResponse.json({ error: "invalid type" }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const { type, id } = await req.json()
  const state = await getState()
  if (type === "expense") await patchState({ expenses: state.expenses.filter(e => e.id !== id) })
  else if (type === "income") await patchState({ income: state.income.filter(e => e.id !== id) })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const { type, id, ...fields } = await req.json()
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 })
  const state = await getState()
  if (type === "expense") {
    const next = state.expenses.map(e => e.id === id ? { ...e, ...fields, id } : e)
    const updated = next.find(e => e.id === id)
    await patchState({ expenses: next })
    if (updated) void recordLearned(updated.name, updated.cat)
    return NextResponse.json({ ok: true, entry: updated })
  }
  if (type === "income") {
    const next = state.income.map(e => e.id === id ? { ...e, ...fields, id } : e)
    await patchState({ income: next })
    return NextResponse.json({ ok: true, entry: next.find(e => e.id === id) })
  }
  return NextResponse.json({ error: "unknown type" }, { status: 400 })
}
