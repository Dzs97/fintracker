import { NextResponse } from "next/server"
import { getFxRate } from "@/lib/fx"

export async function GET() {
  const rate = await getFxRate()
  return NextResponse.json({ rate })
}
