import { NextRequest, NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"

export async function GET() {
  const state = await getState()
  return NextResponse.json({ budgets: state.budgets })
}

export async function POST(req: NextRequest) {
  const { cat, limitMXN } = await req.json()
  const state = await getState()
  const updated = state.budgets.filter(b => b.cat !== cat)
  updated.push({ cat, limitMXN })
  await patchState({ budgets: updated })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { cat } = await req.json()
  const state = await getState()
  await patchState({ budgets: state.budgets.filter(b => b.cat !== cat) })
  return NextResponse.json({ ok: true })
}
