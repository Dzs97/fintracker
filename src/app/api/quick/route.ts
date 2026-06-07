import { NextRequest, NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"
import { nanoid } from "@/lib/utils"
import { parseEntry } from "@/lib/parseEntry"
import type { Expense, Income, CCCharge, Investment } from "@/types"

/**
 * POST /api/quick
 *
 * Body: { text: "782 ubereats openbank" }   ← simplest case
 *   or: { text, dry: true }                  ← preview only, no write
 *
 * Optional gate: set QUICK_TOKEN in Vercel env. Then include
 * `?token=…` in the URL or an `x-quick-token` header.
 *
 * Returns: { ok: true, parsed, entry } on success.
 */
export async function POST(req: NextRequest) {
  const want = process.env.QUICK_TOKEN
  if (want) {
    const got = req.headers.get("x-quick-token") ?? new URL(req.url).searchParams.get("token")
    if (got !== want) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const text = typeof body?.text === "string" ? body.text : ""
  const dry = !!body?.dry
  const parsed = parseEntry(text)

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error, text }, { status: 400 })
  }
  if (dry) return NextResponse.json({ ok: true, parsed })

  const state = await getState()
  let entry: Expense | Income | CCCharge | Investment

  switch (parsed.entry_type) {
    case "expense": {
      entry = { id: nanoid(), name: parsed.name, amount: parsed.amount, cat: parsed.cat as Expense["cat"], date: parsed.date, note: parsed.note }
      await patchState({ expenses: [...state.expenses, entry] })
      break
    }
    case "income": {
      entry = { id: nanoid(), name: parsed.name, amount: parsed.amount, date: parsed.date, note: parsed.note }
      await patchState({ income: [...state.income, entry] })
      break
    }
    case "cc": {
      entry = {
        id: nanoid(), name: parsed.name, amount: parsed.amount, date: parsed.date,
        cat: parsed.cat as CCCharge["cat"], card: parsed.card as CCCharge["card"],
        installments: parsed.installments,
      }
      await patchState({ cc: [...state.cc, entry] })
      break
    }
    case "investment": {
      entry = {
        id: nanoid(), name: parsed.name, amount: parsed.amount, date: parsed.date,
        gf: parsed.gf, inv_type: parsed.inv_type,
      }
      await patchState({ investments: [...state.investments, entry] })
      break
    }
  }

  return NextResponse.json({ ok: true, parsed, entry })
}
