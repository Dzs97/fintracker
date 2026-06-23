import { NextRequest, NextResponse } from "next/server"
import { redis, KEYS } from "@/lib/redis"
import { nanoid } from "@/lib/utils"
import type { Account } from "@/types"

export async function GET() {
  const accounts = (await redis.get<Account[]>(KEYS.accounts)) ?? []
  return NextResponse.json({ accounts })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const list = (await redis.get<Account[]>(KEYS.accounts)) ?? []
  const entry: Account = {
    id: body.id ?? nanoid(),
    name: String(body.name ?? "").trim() || "Account",
    currency: body.currency === "USD" ? "USD" : "MXN",
    balance: Number(body.balance) || 0,
    kind: body.kind ?? "other",
    apr: body.apr != null ? Number(body.apr) : undefined,
    note: body.note,
  }
  const idx = list.findIndex(a => a.id === entry.id)
  const next = idx === -1 ? [...list, entry] : list.map(a => a.id === entry.id ? entry : a)
  await redis.set(KEYS.accounts, next)
  return NextResponse.json({ ok: true, entry })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const list = (await redis.get<Account[]>(KEYS.accounts)) ?? []
  await redis.set(KEYS.accounts, list.filter(a => a.id !== id))
  return NextResponse.json({ ok: true })
}
