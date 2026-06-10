import { NextRequest, NextResponse } from "next/server"
import { redis, KEYS } from "@/lib/redis"
import { nanoid } from "@/lib/utils"
import type { FutureObligation } from "@/types"

/**
 * GET    /api/obligations              → { obligations: FutureObligation[] }
 * POST   /api/obligations              → upsert one (id optional)
 * PATCH  /api/obligations  { id, dec } → mark `dec` installments as paid (default 1)
 *                                        — decrements monthsRemaining; removes if reaches 0.
 * DELETE /api/obligations  { id }      → remove
 */
export async function GET() {
  const obligations = (await redis.get<FutureObligation[]>(KEYS.obligations)) ?? []
  return NextResponse.json({ obligations })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const list = (await redis.get<FutureObligation[]>(KEYS.obligations)) ?? []
  const entry: FutureObligation = {
    id: body.id ?? nanoid(),
    card: body.card,
    description: String(body.description ?? "").trim() || "Obligation",
    monthlyAmount: Number(body.monthlyAmount) || 0,
    monthsRemaining: Math.max(0, Number(body.monthsRemaining) || 0),
    startMonth: body.startMonth,
    notes: body.notes,
  }
  const idx = list.findIndex(o => o.id === entry.id)
  const next = idx === -1 ? [...list, entry] : list.map(o => o.id === entry.id ? entry : o)
  await redis.set(KEYS.obligations, next)
  return NextResponse.json({ ok: true, entry })
}

export async function PATCH(req: NextRequest) {
  const { id, dec } = await req.json()
  const decBy = Math.max(1, Number(dec) || 1)
  const list = (await redis.get<FutureObligation[]>(KEYS.obligations)) ?? []
  const next: FutureObligation[] = []
  for (const o of list) {
    if (o.id === id) {
      const remaining = o.monthsRemaining - decBy
      if (remaining > 0) next.push({ ...o, monthsRemaining: remaining })
      // remaining <= 0 → drop it
    } else {
      next.push(o)
    }
  }
  await redis.set(KEYS.obligations, next)
  return NextResponse.json({ ok: true, obligations: next })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const list = (await redis.get<FutureObligation[]>(KEYS.obligations)) ?? []
  await redis.set(KEYS.obligations, list.filter(o => o.id !== id))
  return NextResponse.json({ ok: true })
}
