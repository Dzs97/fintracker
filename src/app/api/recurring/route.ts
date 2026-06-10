import { NextRequest, NextResponse } from "next/server"
import { redis, KEYS } from "@/lib/redis"
import { nanoid } from "@/lib/utils"
import type { Recurring } from "@/types"

/**
 * GET    /api/recurring                → { recurring: Recurring[] }
 * POST   /api/recurring                → upsert one entry (id optional)
 * DELETE /api/recurring  { id }        → remove
 */
export async function GET() {
  const recurring = (await redis.get<Recurring[]>(KEYS.recurring)) ?? []
  return NextResponse.json({ recurring })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const list = (await redis.get<Recurring[]>(KEYS.recurring)) ?? []
  const entry: Recurring = {
    id: body.id ?? nanoid(),
    name: String(body.name ?? "").trim() || "Recurring",
    type: body.type,
    amount: Number(body.amount) || 0,
    cat: body.cat,
    card: body.card,
    gf: !!body.gf,
    inv_type: body.inv_type,
    dayOfMonth: Math.max(1, Math.min(31, Number(body.dayOfMonth) || 1)),
    active: body.active !== false,
    lastFired: body.lastFired,
    note: body.note,
  }
  const idx = list.findIndex(r => r.id === entry.id)
  const next = idx === -1 ? [...list, entry] : list.map(r => r.id === entry.id ? entry : r)
  await redis.set(KEYS.recurring, next)
  return NextResponse.json({ ok: true, entry })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const list = (await redis.get<Recurring[]>(KEYS.recurring)) ?? []
  await redis.set(KEYS.recurring, list.filter(r => r.id !== id))
  return NextResponse.json({ ok: true })
}
