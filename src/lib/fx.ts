import { redis, KEYS } from "./redis"

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function getFxRate(): Promise<number> {
  const [cached, updatedAt] = await Promise.all([
    redis.get<number>(KEYS.fxRate),
    redis.get<string>(KEYS.fxUpdatedAt),
  ])
  const stale = !updatedAt || Date.now() - new Date(updatedAt).getTime() > CACHE_TTL_MS
  if (cached && !stale) return cached

  try {
    const res = await fetch(
      `https://open.er-api.com/v6/latest/USD`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()
    const rate: number = data?.rates?.MXN ?? cached ?? 17.3
    await Promise.all([
      redis.set(KEYS.fxRate, rate),
      redis.set(KEYS.fxUpdatedAt, new Date().toISOString()),
    ])
    return rate
  } catch {
    return cached ?? 17.3
  }
}
