import { redis, KEYS } from "./redis"

export interface FxConfig {
  markupPct?: number    // applied to live interbank rate, e.g. 1.15 = +1.15%
  fixedRate?: number    // wins over markupPct; locks the rate to a manual value
  source?: string       // freeform label shown on the dashboard ('DolarApp', 'Banxico FIX', etc.)
}

export async function getFxConfig(): Promise<FxConfig> {
  return (await redis.get<FxConfig>(KEYS.fxConfig)) ?? {}
}

export async function setFxConfig(cfg: FxConfig) {
  await redis.set(KEYS.fxConfig, cfg)
}

/** Apply an FX config to a base interbank rate. */
export function applyFxConfig(baseRate: number, cfg: FxConfig): { rate: number; source: string } {
  if (cfg.fixedRate && cfg.fixedRate > 0) {
    return { rate: cfg.fixedRate, source: cfg.source || "manual" }
  }
  if (cfg.markupPct != null && cfg.markupPct !== 0) {
    return { rate: baseRate * (1 + cfg.markupPct / 100), source: cfg.source || "interbank + markup" }
  }
  return { rate: baseRate, source: cfg.source || "interbank" }
}
