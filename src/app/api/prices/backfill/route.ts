import { NextResponse } from "next/server"
import { getState, patchState } from "@/lib/state"
import { stampNavs } from "@/lib/stampNav"
import type { Investment } from "@/types"

/**
 * POST /api/prices/backfill
 * For every stock-typed investment that lacks `purchase_price`,
 * fetch Yahoo's historical close on that entry's date and stamp it.
 *
 * Body: { overwrite?: boolean }  (default false — only touches missing)
 * Idempotent unless overwrite=true.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const overwrite = !!body?.overwrite

  const state = await getState()
  const targets = state.investments.filter((i: Investment) =>
    i.inv_type === "stock" && (overwrite || typeof i.purchase_price !== "number")
  )
  if (targets.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, note: "no stock entries need backfill" })
  }

  // When overwrite=true we have to clear purchase_price first so stampNavs picks them up
  const prepped = overwrite
    ? targets.map(({ purchase_price: _drop, ...rest }) => rest as Investment)
    : targets
  const stamped = await stampNavs(prepped)

  const byId = new Map(stamped.map(s => [s.id, s]))
  const merged = state.investments.map((i: Investment) => byId.get(i.id) ?? i)
  await patchState({ investments: merged })

  const updated = stamped.filter(s => typeof s.purchase_price === "number").length
  return NextResponse.json({
    ok: true,
    updated,
    skipped: stamped.length - updated,
    sample: stamped.slice(0, 5).map(s => ({ id: s.id, name: s.name, date: s.date, purchase_price: s.purchase_price })),
  })
}
