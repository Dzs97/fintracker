import { NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"
import { stampNavs } from "@/lib/stampNav"
import type { Investment } from "@/types"

/**
 * POST /api/funds/backfill
 * For every fund-typed investment that lacks `purchase_nav`,
 * fetch Fintual's NAV on that entry's date and stamp it.
 * Idempotent — re-running only touches entries still missing the field.
 */
export async function POST() {
  const state = await getState()
  const missing = state.investments.filter((i: Investment) =>
    i.inv_type === "fund" && typeof i.purchase_nav !== "number"
  )
  if (missing.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, note: "all fund entries already have purchase_nav" })
  }
  const stamped = await stampNavs(missing)
  const byId = new Map(stamped.map(s => [s.id, s]))
  const merged = state.investments.map((i: Investment) => byId.get(i.id) ?? i)
  await patchState({ investments: merged })

  const updated = stamped.filter(s => typeof s.purchase_nav === "number").length
  return NextResponse.json({
    ok: true,
    updated,
    skipped: stamped.length - updated,
    sample: stamped.slice(0, 5).map(s => ({ id: s.id, name: s.name, date: s.date, purchase_nav: s.purchase_nav })),
  })
}
