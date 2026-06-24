/**
 * Per-user learned category overrides.
 * Whenever a user submits an expense or CC charge with an explicit category,
 * we remember `tokens(name) → category` so that next time the parser sees
 * the same token, it picks the user's choice instead of the built-in keyword map.
 */
import { redis, KEYS } from "./redis"

export type LearnedMap = Record<string, string>

const SKIP_TOKENS = new Set([
  // stopwords (en/es)
  "the", "a", "el", "la", "de", "del", "en", "para", "and", "one",
  "y", "o", "un", "una", "card", "payment", "statement", "settled",
  // generic words that wrongly poison categories when learned
  "food", "house", "foot", "care", "online", "transfer", "fees", "final",
  "plan", "pagos", "pago", "financing", "diferidos", "retail", "mexico", "mex",
  // payment platforms — they carry no category signal of their own
  "paypal", "mercadopago", "mercado", "membership", "spei", "transferencia",
  // card + account names
  "openbank", "amex", "invex", "dolarapp", "savings", "nubank",
  // months
  "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
  // currencies / units
  "usd", "mxn", "msi", "meses",
])

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(t => t.length >= 4 && !SKIP_TOKENS.has(t))
}

export async function loadLearned(): Promise<LearnedMap> {
  return (await redis.get<LearnedMap>(KEYS.learnedCats)) ?? {}
}

export async function recordLearned(name: string, cat: string) {
  if (!name || !cat || cat === "Other") return
  const map = await loadLearned()
  let changed = false
  for (const t of tokenize(name)) {
    if (map[t] !== cat) { map[t] = cat; changed = true }
  }
  if (changed) await redis.set(KEYS.learnedCats, map)
}

/**
 * Given a free-text entry name, return the best learned category (or null).
 * Picks the most-recently-set token match if multiple tokens hit different cats.
 * Object key insertion order in Upstash JSON round-trips reliably, so the last
 * write wins.
 */
export function lookupLearned(name: string, learned: LearnedMap): string | null {
  const toks = tokenize(name)
  // Walk in reverse insertion order so the freshest assignment wins
  const order = Object.keys(learned)
  for (let i = order.length - 1; i >= 0; i--) {
    if (toks.includes(order[i])) return learned[order[i]]
  }
  return null
}
