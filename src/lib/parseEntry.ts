/**
 * Natural language → structured FinTracker entry.
 * Mirror of scripts/log.ts so the same rules run server-side.
 *
 * Examples it handles:
 *   "782 ubereats openbank"     → CC charge on OpenBank
 *   "625 usd income treeline"   → income in USD
 *   "750 nubank stock mine"     → investment (stock, mine)
 *   "1500 fintual fund gf"      → investment (fund, gf)
 *   "150 coffee dolarapp"       → direct expense (Food & Dining)
 *   "3000 amex 3 msi nagaoka"   → CC w/ 3 installments
 */

const CATS: Record<string, string> = {
  uber: "Transport", taxi: "Transport", metro: "Transport", gas: "Transport",
  ubereats: "Food & Dining", restaurant: "Food & Dining", lunch: "Food & Dining",
  coffee: "Food & Dining", cafe: "Food & Dining", dinner: "Food & Dining", nagaoka: "Food & Dining",
  super: "Groceries", groceries: "Groceries", walmart: "Groceries", sumesa: "Groceries",
  amazon: "Shopping", liverpool: "Shopping", zara: "Shopping",
  netflix: "Entertainment", spotify: "Entertainment", cinema: "Entertainment",
  gym: "Health", doctor: "Health", farmacia: "Health",
  rent: "Housing", airbnb: "Housing",
  sakura: "Pets", veterinaria: "Pets", petco: "Pets",
  card: "Card Payments",
}

const CC_CARDS = ["openbank", "amex", "invex"]
const CARD_MAP: Record<string, string> = { openbank: "OpenBank", amex: "Amex", invex: "Invex" }
const INV_TYPES = ["fund", "stock", "fondo", "accion"]
const INCOME_KEYWORDS = ["income", "salary", "ingreso", "pago", "treeline", "usd"]
const INV_KEYWORDS = ["fintual", "nubank", "nu", "gbm", "stock", "fund", "invest", "compra"]
// Names that are inherently funds — if the entry text mentions any, treat as fund
// even when no explicit "fund" / "fondo" keyword is present.
const FUND_NAMES = ["fintual", "risky hayek", "moderate portman", "risky norris", "moderate pitt", "conservative clooney", "very conservative streep"]
const STRIP_TOKENS = new Set([
  "gf", "mine", "me", "stock", "fund", "fondo", "usd", "mxn",
  "income", "salary", "invest", "historical",
  "jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec",
  "msi","meses","mensualidades","installments",
])

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
}

function today(): string {
  return new Date().toISOString().split("T")[0]
}

function guessCategory(text: string): string {
  const lower = text.toLowerCase()
  for (const [k, v] of Object.entries(CATS)) {
    if (lower.includes(k)) return v
  }
  return "Other"
}

export type ParsedEntry =
  | { entry_type: "expense";    name: string; amount: number; date: string; cat: string; note?: string }
  | { entry_type: "income";     name: string; amount: number; date: string; note?: string }
  | { entry_type: "cc";         name: string; amount: number; date: string; cat: string; card: string; installments: number }
  | { entry_type: "investment"; name: string; amount: number; date: string; gf: boolean; inv_type: "fund" | "stock" }

export function parseEntry(raw: string): ParsedEntry | { error: string } {
  const text = (raw ?? "").trim()
  if (!text) return { error: "empty input" }

  const lower = text.toLowerCase()
  const tokens = lower.split(/\s+/)

  // Amount: first number
  const amtMatch = text.match(/(\d+(?:\.\d+)?)/)
  if (!amtMatch) return { error: "no amount found" }
  const amount = parseFloat(amtMatch[1])

  // Date: explicit YYYY-MM-DD, or "jun 4" / "june 4"
  let date = today()
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) date = isoMatch[1]
  const moMatch = text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})/i)
  if (moMatch) {
    const y = new Date().getFullYear()
    date = `${y}-${MONTHS[moMatch[1].toLowerCase()]}-${String(parseInt(moMatch[2])).padStart(2, "0")}`
  }

  // Name = tokens minus numbers/cards/keywords
  const nameTokens = tokens.filter(t => !/^\d/.test(t) && !CC_CARDS.includes(t) && !STRIP_TOKENS.has(t))
  const name = nameTokens.join(" ").trim() || text.split(/\s+/).slice(1, 3).join(" ")

  const isIncome = INCOME_KEYWORDS.some(k => lower.includes(k))
  const isInvestment = INV_KEYWORDS.some(k => lower.includes(k))
  const isDolarApp = lower.includes("dolarapp")
  const ccCard = CC_CARDS.find(c => lower.includes(c))
  const isCC = !!ccCard && !isInvestment

  // Installments: "3 msi" / "12 meses"
  const instMatch = text.match(/(\d+)\s*(msi|meses|mensualidades|installments)/i)
  const installments = instMatch ? parseInt(instMatch[1]) : 1

  if (isIncome) {
    return { entry_type: "income", name: name || "Income", amount, date }
  }
  if (isInvestment) {
    const isGF = lower.includes("gf") || lower.includes(" her ")
    const tRaw = INV_TYPES.find(t => lower.includes(t))
    const isKnownFund = FUND_NAMES.some(f => lower.includes(f))
    const inv_type: "fund" | "stock" =
      (tRaw === "fondo" || tRaw === "fund") ? "fund"
      : isKnownFund ? "fund"
      : "stock"
    const invName = nameTokens.find(t => INV_KEYWORDS.includes(t)) ?? name
    // Capitalize known investment names nicely
    const pretty = invName.charAt(0).toUpperCase() + invName.slice(1)
    return { entry_type: "investment", name: pretty, amount, date, gf: isGF, inv_type }
  }
  if (isCC && ccCard) {
    return {
      entry_type: "cc", name, amount, date,
      cat: guessCategory(text),
      card: CARD_MAP[ccCard],
      installments,
    }
  }
  // Default: direct expense
  return {
    entry_type: "expense", name, amount, date,
    cat: guessCategory(text),
    note: isDolarApp ? "DolarApp" : undefined,
  }
}
