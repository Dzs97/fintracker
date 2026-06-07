import { NextRequest, NextResponse } from "next/server"
import { getSplits, setSplits, expandInvestment, type SplitLeg } from "@/lib/splits"
import { getState, patchState } from "@/lib/state"
import type { Investment } from "@/types"

/**
 * GET  /api/splits                                  → all rules
 * PUT  /api/splits  { name, legs: SplitLeg[] }      → set/clear one rule (legs=[] removes)
 * POST /api/splits/migrate?name=Fintual             → apply current rule to EXISTING
 *                                                    investments named `name`, replacing
 *                                                    them with their split legs.
 */
export async function GET() {
  const splits = await getSplits()
  return NextResponse.json({ splits })
}

export async function PUT(req: NextRequest) {
  const { name, legs } = await req.json()
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "missing name" }, { status: 400 })
  }
  const splits = await getSplits()
  if (!Array.isArray(legs) || legs.length === 0) {
    delete splits[name]
  } else {
    const sum = legs.reduce((s: number, l: SplitLeg) => s + (l.weight ?? 0), 0)
    if (sum <= 0 || sum > 1.0001) {
      return NextResponse.json({ error: `weights must sum to <= 1.0, got ${sum}` }, { status: 400 })
    }
    splits[name] = legs
  }
  await setSplits(splits)
  return NextResponse.json({ ok: true, splits })
}

export async function POST(req: NextRequest) {
  // Migration: apply the rule to all existing investments with the given name
  const url = new URL(req.url)
  const name = url.searchParams.get("name")
  if (!name) return NextResponse.json({ error: "missing ?name=" }, { status: 400 })

  const splits = await getSplits()
  const legsCfg = Object.keys(splits).find(k => k.toLowerCase() === name.toLowerCase())
  if (!legsCfg) return NextResponse.json({ error: `no split rule for "${name}"` }, { status: 404 })

  const state = await getState()
  const matches = state.investments.filter((i: Investment) => i.name.toLowerCase() === name.toLowerCase())
  if (matches.length === 0) return NextResponse.json({ ok: true, migrated: 0, note: "nothing to migrate" })

  const keep = state.investments.filter((i: Investment) => i.name.toLowerCase() !== name.toLowerCase())
  const expanded: Investment[] = []
  for (const m of matches) {
    const legs = expandInvestment(m, splits)
    expanded.push(...legs)
  }
  await patchState({ investments: [...keep, ...expanded] })
  return NextResponse.json({ ok: true, migrated: matches.length, intoLegs: expanded.length })
}
