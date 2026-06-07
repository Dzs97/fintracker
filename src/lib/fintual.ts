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
