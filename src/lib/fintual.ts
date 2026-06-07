// Fintual public API — no auth required for fund prices
// Docs: https://fintual.com/api-docs

export interface FintualFund {
  id: number
  name: string
  symbol: string
  nav: number        // net asset value per share in CLP/MXN depending on account
  currency: string
  updatedAt: string
}

// Map common Fintual fund names to their asset IDs
// These are the public "Real Assets" IDs
const FUND_IDS: Record<string, number> = {
  "Risky Norris":    186,
  "Moderate Pitt":   187,
  "Conservative Clooney": 188,
  "Very Conservative Streep": 189,
}

export async function getFintualPrice(fundName: string): Promise<FintualFund | null> {
  const id = FUND_IDS[fundName]
  if (!id) return null
  try {
    const res = await fetch(
      `https://fintual.com/api/real_assets/${id}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const attrs = data?.data?.attributes
    if (!attrs) return null
    return {
      id,
      name: fundName,
      symbol: attrs.symbol ?? fundName,
      nav: attrs.nav ?? 0,
      currency: attrs.currency ?? "MXN",
      updatedAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}
