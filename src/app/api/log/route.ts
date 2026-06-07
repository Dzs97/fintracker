import { NextRequest, NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"
import { nanoid } from "@/lib/utils"
import type { Expense, Income, CCCharge, Investment, Category, CCCard } from "@/types"

// Natural language → structured entry
// Called by the CLI log helper with pre-parsed fields
export async function POST(req: NextRequest) {
  const body = await req.json()
  const state = await getState()
  const today = new Date().toISOString().split("T")[0]

  const {
    entry_type,   // "expense" | "income" | "cc" | "investment"
    name,
    amount,
    date = today,
    cat,
    card,
    note,
    gf = false,
    inv_type,
    purchase_price,
    installments = 1,
  } = body

  let result: unknown

  switch (entry_type) {
    case "expense": {
      const entry: Expense = { id: nanoid(), name, amount: Number(amount), cat, date, note }
      await patchState({ expenses: [...state.expenses, entry] })
      result = entry
      break
    }
    case "income": {
      const entry: Income = { id: nanoid(), name, amount: Number(amount), date, note }
      await patchState({ income: [...state.income, entry] })
      result = entry
      break
    }
    case "cc": {
      const entry: CCCharge = { id: nanoid(), name, amount: Number(amount), date, cat, card, installments }
      await patchState({ cc: [...state.cc, entry] })
      result = entry
      break
    }
    case "investment": {
      const entry: Investment = { id: nanoid(), name, amount: Number(amount), date, note, gf, inv_type, purchase_price }
      await patchState({ investments: [...state.investments, entry] })
      result = entry
      break
    }
    default:
      return NextResponse.json({ error: "unknown entry_type" }, { status: 400 })
  }

  return NextResponse.json({ ok: true, entry: result })
}
