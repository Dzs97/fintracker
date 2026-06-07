/**
 * Per-user learned category overrides.
 * Whenever a user submits an expense or CC charge with an explicit category,
 * we remember `tokens(name) → category` so that next time the parser sees
 * the same token, it picks the user's choice instead of the built-in keyword map.
 */
import { redis, KEYS } from "./redis"

export type LearnedMap = Record<string, string>

const SKIP_TOKENS = new Set([
  "the", "a", "el", "la", "de", "del", "en", "en", "para",
  "y", "o", "un", "una", "card", "payment", "statement", "settled",
])

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(t => t.length >= 3 && !SKIP_TOKENS.has(t))
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
