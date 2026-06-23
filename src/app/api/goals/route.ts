import { NextRequest, NextResponse } from "next/server"
import { redis, KEYS } from "@/lib/redis"
import { nanoid } from "@/lib/utils"
import type { Goal } from "@/types"

export async function GET() {
  const goals = (await redis.get<Goal[]>(KEYS.goals)) ?? []
  return NextResponse.json({ goals })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const list = (await redis.get<Goal[]>(KEYS.goals)) ?? []
  const entry: Goal = {
    id: body.id ?? nanoid(),
    title: String(body.title ?? "").trim() || "Goal",
    kind: body.kind ?? "savings",
    target: Number(body.target) || 0,
    currency: body.currency === "USD" ? "USD" : "MXN",
    current: body.current != null ? Number(body.current) : undefined,
    targetDate: body.targetDate,
    note: body.note,
  }
  const idx = list.findIndex(g => g.id === entry.id)
  const next = idx === -1 ? [...list, entry] : list.map(g => g.id === entry.id ? entry : g)
  await redis.set(KEYS.goals, next)
  return NextResponse.json({ ok: true, entry })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const list = (await redis.get<Goal[]>(KEYS.goals)) ?? []
  await redis.set(KEYS.goals, list.filter(g => g.id !== id))
  return NextResponse.json({ ok: true })
}
