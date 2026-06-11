import { NextRequest, NextResponse } from "next/server"
import { getFxRate } from "@/lib/fx"
import { applyFxConfig, getFxConfig, setFxConfig } from "@/lib/fxConfig"

/**
 * GET  /api/fx                                          → { rate, baseRate, source, markupPct?, fixedRate? }
 * PUT  /api/fx { markupPct?, fixedRate?, source? }      → save config; null/0/"" clears the field
 *
 * The effective `rate` is what the rest of the app should use. `baseRate` is
 * the underlying interbank rate (from open.er-api.com) before any markup.
 */
export async function GET() {
  const baseRate = await getFxRate()
  const cfg = await getFxConfig()
  const { rate, source } = applyFxConfig(baseRate, cfg)
  return NextResponse.json({
    rate,
    baseRate,
    source,
    markupPct: cfg.markupPct,
    fixedRate: cfg.fixedRate,
  })
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const cfg = {
    markupPct: body.markupPct === null || body.markupPct === "" || Number(body.markupPct) === 0 ? undefined : Number(body.markupPct),
    fixedRate: body.fixedRate === null || body.fixedRate === "" || Number(body.fixedRate) === 0 ? undefined : Number(body.fixedRate),
    source:    body.source && typeof body.source === "string" && body.source.trim() ? body.source.trim() : undefined,
  }
  await setFxConfig(cfg)
  const baseRate = await getFxRate()
  const { rate, source } = applyFxConfig(baseRate, cfg)
  return NextResponse.json({
    ok: true,
    rate, baseRate, source,
    markupPct: cfg.markupPct,
    fixedRate: cfg.fixedRate,
  })
}
