import { NextRequest, NextResponse } from "next/server"
import { redis, KEYS } from "@/lib/redis"
import type { LearnedMap } from "@/lib/learnedCats"

// GET    /api/learned                       → { learned: { token: cat } }
export async function GET() {
  const learned = (await redis.get<LearnedMap>(KEYS.learnedCats)) ?? {}
  return NextResponse.json({ learned, count: Object.keys(learned).length })
}

// DELETE /api/learned  { keys: string[] }   → remove those tokens
//        /api/learned  { key: string }      → remove one token
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const keys: string[] = Array.isArray(body.keys) ? body.keys : body.key ? [body.key] : []
  const learned = (await redis.get<LearnedMap>(KEYS.learnedCats)) ?? {}
  const removed: string[] = []
  for (const k of keys) {
    if (k in learned) { delete learned[k]; removed.push(k) }
  }
  await redis.set(KEYS.learnedCats, learned)
  return NextResponse.json({ ok: true, removed, count: Object.keys(learned).length })
}

// PUT    /api/learned  { key, cat }          → set/override one token
//        /api/learned  { map: {token:cat} }  → merge in several
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const learned = (await redis.get<LearnedMap>(KEYS.learnedCats)) ?? {}
  if (body.map && typeof body.map === "object") {
    for (const [k, v] of Object.entries(body.map as Record<string, string>)) learned[k.toLowerCase()] = String(v)
  } else if (body.key && body.cat) {
    learned[String(body.key).toLowerCase()] = String(body.cat)
  }
  await redis.set(KEYS.learnedCats, learned)
  return NextResponse.json({ ok: true, count: Object.keys(learned).length })
}
