import { NextRequest, NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"
import { nanoid } from "@/lib/utils"
import type { Statement, Expense } from "@/types"

/**
 * GET    /api/statements                                → { statements: Statement[] }
 * POST   /api/statements                                → upsert (id optional)
 *   { card, period, closingBalance, paid?, dueOn?, notes? }
 * PATCH  /api/statements  { id, amount, paidOn?, note? } → record a payment:
 *   - creates an Expense entry in "Card Payments" category for `amount` on paidOn
 *   - increments the statement's `paid` field by `amount`
 *   - records a small note linking the two
 * DELETE /api/statements  { id }                        → remove a statement
 *                                                        (does not touch related expenses)
 */
export async function GET() {
  const state = await getState()
  return NextResponse.json({ statements: state.statements ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const state = await getState()
  const list = state.statements ?? []
  const incoming: Statement = {
    id: body.id ?? nanoid(),
    card: body.card,
    period: body.period,
    closingBalance: Number(body.closingBalance) || 0,
    totalOwed: body.totalOwed != null ? Number(body.totalOwed) : undefined,
    pagoMinimo: body.pagoMinimo != null ? Number(body.pagoMinimo) : undefined,
    paid: Number(body.paid) || 0,
    dueOn: body.dueOn,
    notes: body.notes,
  }
  const idx = list.findIndex(s => s.id === incoming.id)
  const next = idx === -1 ? [...list, incoming] : list.map(s => s.id === incoming.id ? incoming : s)
  await patchState({ statements: next })
  return NextResponse.json({ ok: true, statement: incoming })
}

export async function PATCH(req: NextRequest) {
  const { id, amount, paidOn, note } = await req.json()
  if (!id || !amount || amount <= 0) {
    return NextResponse.json({ error: "missing id or amount" }, { status: 400 })
  }
  const state = await getState()
  const list = state.statements ?? []
  const stmt = list.find(s => s.id === id)
  if (!stmt) return NextResponse.json({ error: "statement not found" }, { status: 404 })

  const date = paidOn ?? new Date().toISOString().split("T")[0]
  // 1) real expense entry so cash math is honest
  const expense: Expense = {
    id: nanoid(),
    name: `${stmt.card} ${stmt.period} statement`,
    amount: Number(amount),
    cat: "Card Payments",
    date,
    note: note ?? "statement payment",
  }
  // 2) update the statement's paid total
  const updated: Statement = { ...stmt, paid: stmt.paid + Number(amount) }
  const nextList = list.map(s => s.id === id ? updated : s)

  await patchState({
    expenses: [...state.expenses, expense],
    statements: nextList,
  })
  return NextResponse.json({ ok: true, statement: updated, expense })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const state = await getState()
  const list = state.statements ?? []
  await patchState({ statements: list.filter(s => s.id !== id) })
  return NextResponse.json({ ok: true })
}
