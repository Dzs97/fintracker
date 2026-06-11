/**
 * Fintual public API — covers both Chilean and Mexican funds.
 * Strategy: resolve fund by NAME (case-insensitive) against /conceptual_assets,
 * then fetch its latest NAV via /real_assets?conceptual_asset_id=…
 *
 * Examples Mexico:  "Risky Hayek", "Moderate Portman"
 * Examples Chile:   "Risky Norris", "Moderate Pitt"
 */

export interface FundQuote {
  name: string         // canonical name from Fintual
  symbol: string
  conceptualId: number
  realAssetId: number
  nav: number          // net asset value per share
  currency: string     // typically MXN for Mexican funds
  asOf: string         // YYYY-MM-DD
  updatedAt: string    // when we fetched
}

// Cache resolved conceptual IDs in memory across requests in the same lambda
const idCache: Record<string, number> = {}

async function resolveConceptualId(name: string): Promise<{ id: number; canonical: string; symbol: string; currency: string } | null> {
  const key = name.toLowerCase()
  if (idCache[key]) {
    // We still need the symbol/canonical — refetch on cold start; cheap.
  }
  try {
    const url = `https://fintual.com/api/conceptual_assets?name=${encodeURIComponent(name)}`
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) return null
    const json = await res.json()
    const arr = json?.data
    if (!Array.isArray(arr) || arr.length === 0) return null
    // Prefer exact-name match; otherwise take the first
    const exact = arr.find((d: { attributes?: { name?: string } }) =>
      (d.attributes?.name ?? "").toLowerCase() === name.toLowerCase()
    )
    const hit = exact ?? arr[0]
    const id = parseInt(hit.id, 10)
    idCache[key] = id
    return {
      id,
      canonical: hit.attributes?.name ?? name,
      symbol:    hit.attributes?.symbol ?? "",
      currency:  hit.attributes?.currency ?? "MXN",
    }
  } catch {
    return null
  }
}

/**
 * Historical NAV for a specific date (YYYY-MM-DD).
 * If the exact date isn't in the series (weekend/holiday/before-launch),
 * the API typically returns []. We retry up to 7 days back so weekend
 * buys resolve to the prior trading day's NAV.
 */
export async function getFintualNavOn(fundName: string, date: string): Promise<{ nav: number; date: string; currency: string } | null> {
  const meta = await resolveConceptualId(fundName)
  if (!meta) return null
  // Find the freshest real_asset id for this conceptual
  let realId: number | null = null
  try {
    const url = `https://fintual.com/api/real_assets?conceptual_asset_id=${meta.id}`
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (res.ok) {
      const json = await res.json()
      const arr = json?.data
      if (Array.isArray(arr) && arr.length > 0) {
        // Sort by freshest last_day.date and pick top
        const sorted = [...arr].sort((a, b) =>
          (b.attributes?.last_day?.date ?? "").localeCompare(a.attributes?.last_day?.date ?? "")
        )
        realId = parseInt(sorted[0].id, 10)
      }
    }
  } catch { return null }
  if (!realId) return null

  // Walk back up to 7 days to handle weekends/holidays
  const start = new Date(date + "T12:00:00Z")
  for (let i = 0; i < 8; i++) {
    const d = new Date(start.getTime() - i * 86400000)
    const ds = d.toISOString().split("T")[0]
    try {
      const url = `https://fintual.com/api/real_assets/${realId}/days?date=${ds}`
      const res = await fetch(url, { next: { revalidate: 86400 } })
      if (!res.ok) continue
      const json = await res.json()
      const row = json?.data?.[0]?.attributes
      if (row && typeof row.net_asset_value === "number") {
        return { nav: row.net_asset_value, date: row.date ?? ds, currency: meta.currency }
      }
    } catch { /* try the next day back */ }
  }
  return null
}

/** Daily NAV series for the last ~6 months. */
export async function getFintualHistory(fundName: string): Promise<Array<{ date: string; price: number }> | null> {
  const meta = await resolveConceptualId(fundName)
  if (!meta) return null
  try {
    const listRes = await fetch(`https://fintual.com/api/real_assets?conceptual_asset_id=${meta.id}`, { next: { revalidate: 86400 } })
    if (!listRes.ok) return null
    const listJson = await listRes.json()
    const arr = listJson?.data
    if (!Array.isArray(arr) || arr.length === 0) return null
    const sorted = [...arr].sort((a, b) =>
      (b.attributes?.last_day?.date ?? "").localeCompare(a.attributes?.last_day?.date ?? "")
    )
    const realId = parseInt(sorted[0].id, 10)
    const to = new Date()
    const from = new Date(to.getTime() - 183 * 86400000)
    const fmtD = (d: Date) => d.toISOString().split("T")[0]
    const res = await fetch(
      `https://fintual.com/api/real_assets/${realId}/days?from_date=${fmtD(from)}&to_date=${fmtD(to)}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const json = await res.json()
    const days = json?.data
    if (!Array.isArray(days)) return null
    const out = days
      .map((d: { attributes?: { date?: string; net_asset_value?: number } }) => ({
        date: d.attributes?.date ?? "",
        price: d.attributes?.net_asset_value ?? NaN,
      }))
      .filter(d => d.date && isFinite(d.price))
      .sort((a, b) => a.date.localeCompare(b.date))
    return out.length ? out : null
  } catch {
    return null
  }
}

export async function getFintualPrice(fundName: string): Promise<FundQuote | null> {
  const meta = await resolveConceptualId(fundName)
  if (!meta) return null
  try {
    const url = `https://fintual.com/api/real_assets?conceptual_asset_id=${meta.id}`
    const res = await fetch(url, { next: { revalidate: 600 } }) // 10-min edge cache
    if (!res.ok) return null
    const json = await res.json()
    const arr = json?.data
    if (!Array.isArray(arr) || arr.length === 0) return null
    // Pick the series with the freshest non-null NAV
    const withNav = arr
      .map((d: { id: string; attributes?: { last_day?: { net_asset_value?: number; date?: string } } }) => ({
        realId: parseInt(d.id, 10),
        nav: d.attributes?.last_day?.net_asset_value,
        date: d.attributes?.last_day?.date,
      }))
      .filter((d): d is { realId: number; nav: number; date: string } => typeof d.nav === "number" && !!d.date)
      .sort((a, b) => b.date.localeCompare(a.date))
    if (!withNav.length) return null
    const top = withNav[0]
    return {
      name: meta.canonical,
      symbol: meta.symbol,
      conceptualId: meta.id,
      realAssetId: top.realId,
      nav: top.nav,
      currency: meta.currency,
      asOf: top.date,
      updatedAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}
