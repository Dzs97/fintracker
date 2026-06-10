import { NextRequest, NextResponse } from "next/server"
import { redis, KEYS } from "@/lib/redis"
import type { CardConfig } from "@/lib/cardCycles"

/**
 * GET  /api/cards/config                  → { config: Record<card, CardConfig> }
 * PUT  /api/cards/config { card, cutoffDay, dueDay }   → upsert one entry
 *                                                       (cutoffDay/dueDay null → remove)
 */
export async function GET() {
  const config = (await redis.get<Record<string, CardConfig>>(KEYS.cardConfig)) ?? {}
  return NextResponse.json({ config })
}

export async function PUT(req: NextRequest) {
  const { card, cutoffDay, dueDay } = await req.json()
  if (!card || typeof card !== "string") {
    return NextResponse.json({ error: "missing card" }, { status: 400 })
  }
  const config = (await redis.get<Record<string, CardConfig>>(KEYS.cardConfig)) ?? {}
  if (cutoffDay == null && dueDay == null) {
    delete config[card]
  } else {
    const c = Math.max(1, Math.min(31, Number(cutoffDay) || 1))
    const d = Math.max(1, Math.min(31, Number(dueDay)    || 1))
    config[card] = { cutoffDay: c, dueDay: d }
  }
  await redis.set(KEYS.cardConfig, config)
  return NextResponse.json({ ok: true, config })
}
