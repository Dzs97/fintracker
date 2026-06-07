import { NextResponse } from "next/server"

// Names only — never values. Safe to leave deployed.
export async function GET() {
  const present = Object.keys(process.env).filter(k =>
    /UPSTASH|KV_|REDIS/.test(k)
  ).sort()
  return NextResponse.json({ present })
}
