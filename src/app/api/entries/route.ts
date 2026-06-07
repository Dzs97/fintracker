import { NextRequest, NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"
import { nanoid } from "@/lib/utils"
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
