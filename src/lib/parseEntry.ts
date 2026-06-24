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

// Keyword → canonical category. Mix of English and Spanish so MX bank
// statements (which are in Spanish) get parsed without needing a separate
// language toggle. Order matters only for ties — case-insensitive substring match.
const CATS: Record<string, string> = {
  // ── Transport ────────────────────────────────────────────────
  uber: "Transport", taxi: "Transport", metro: "Transport",
  gas: "Transport", gasolina: "Transport", pemex: "Transport",
  didi: "Transport", cabify: "Transport", transporte: "Transport",
  flecha: "Transport", ado: "Transport",
  estacionamiento: "Transport", parquimetro: "Transport", parking: "Transport",
  peaje: "Transport", caseta: "Transport",

  // ── Food & Dining ────────────────────────────────────────────
  ubereats: "Food & Dining", "uber eats": "Food & Dining", rappi: "Food & Dining",
  doordash: "Food & Dining", "didi food": "Food & Dining", didifood: "Food & Dining",
  restaurant: "Food & Dining", restaurante: "Food & Dining",
  comida: "Food & Dining", lunch: "Food & Dining", almuerzo: "Food & Dining",
  desayuno: "Food & Dining", dinner: "Food & Dining", cena: "Food & Dining",
  coffee: "Food & Dining", cafe: "Food & Dining", cafeteria: "Food & Dining",
  starbucks: "Food & Dining", nagaoka: "Food & Dining", bar: "Food & Dining",
  panaderia: "Food & Dining", taqueria: "Food & Dining", taco: "Food & Dining",

  // ── Groceries ────────────────────────────────────────────────
  super: "Groceries", supermercado: "Groceries", groceries: "Groceries",
  walmart: "Groceries", soriana: "Groceries", chedraui: "Groceries",
  costco: "Groceries", sams: "Groceries", sumesa: "Groceries",
  mercado: "Groceries", aurrera: "Groceries", heb: "Groceries",
  fruteria: "Groceries", carniceria: "Groceries",

  // ── Shopping ─────────────────────────────────────────────────
  amazon: "Shopping", mercadolibre: "Shopping", "mercado libre": "Shopping",
  liverpool: "Shopping", sears: "Shopping",
  palacio: "Shopping", sanborns: "Shopping",

  // ── Entertainment ────────────────────────────────────────────
  netflix: "Entertainment", spotify: "Entertainment", "hbo": "Entertainment",
  disney: "Entertainment", "apple tv": "Entertainment", appletv: "Entertainment",
  prime: "Entertainment", crunchyroll: "Entertainment",
  cinema: "Entertainment", cine: "Entertainment", cinepolis: "Entertainment",
  cinemex: "Entertainment", boletos: "Entertainment", ticketmaster: "Entertainment",
  concierto: "Entertainment", musica: "Entertainment",

  // ── Health ───────────────────────────────────────────────────
  gym: "Health", gimnasio: "Health", smartfit: "Health",
  doctor: "Health", medico: "Health", dentista: "Health", dentist: "Health",
  hospital: "Health", clinica: "Health", consultorio: "Health",
  farmacia: "Health", pharmacy: "Health", medicines: "Health", medicinas: "Health",
  medicamento: "Health", medicamentos: "Health", laboratorio: "Health",
  optica: "Health", oftalmologo: "Health",

  // ── Housing ──────────────────────────────────────────────────
  rent: "Housing", renta: "Housing", airbnb: "Housing",
  hipoteca: "Housing", hospedaje: "Housing", servicios: "Housing",
  luz: "Housing", agua: "Housing", internet: "Housing", telmex: "Housing",
  izzi: "Housing", cfe: "Housing", "gas natural": "Housing",
  predial: "Housing", mantenimiento: "Housing",

  // ── Pets ─────────────────────────────────────────────────────
  sakura: "Pets", veterinaria: "Pets", veterinario: "Pets",
  vet: "Pets", petco: "Pets", maskota: "Pets", mascota: "Pets",
  perro: "Pets", gato: "Pets", croquetas: "Pets",

  // ── Card Payments / Transfers ─────────────────────────────────
  card: "Card Payments", "pago tarjeta": "Card Payments",
  "pago de tarjeta": "Card Payments", statement: "Card Payments",
  spei: "Card Payments", transferencia: "Card Payments",

  // ── Furniture ─────────────────────────────────────────────────
  ikea: "Furniture", luuna: "Furniture", sofa: "Furniture",
  mueble: "Furniture", muebles: "Furniture", muebleria: "Furniture",
  colchon: "Furniture", "casa rodrigu": "Furniture",
  casarodrigu: "Furniture", "mercado libre muebles": "Furniture",

  // ── Gifts ─────────────────────────────────────────────────────
  enviaflores: "Gifts", "envia flores": "Gifts", flores: "Gifts",
  regalo: "Gifts", regalos: "Gifts", gift: "Gifts", florist: "Gifts",

  // ── House Supplies ────────────────────────────────────────────
  "casa caliza": "House Supplies", casacaliza: "House Supplies",
  caliza: "House Supplies", "home depot": "House Supplies",
  homedepot: "House Supplies", ferreteria: "House Supplies",
  sodimac: "House Supplies", truper: "House Supplies",
  "the home store": "House Supplies",

  // ── Clothes ───────────────────────────────────────────────────
  blacornio: "Clothes", "h&m": "Clothes", hennes: "Clothes",
  shein: "Clothes", "old navy": "Clothes", oldnavy: "Clothes",
  uniqlo: "Clothes", forever21: "Clothes", "forever 21": "Clothes",
  pull: "Clothes", bershka: "Clothes", boutique: "Clothes",
  ropa: "Clothes", zara: "Clothes",
}

const CC_CARDS = ["openbank", "amex", "invex"]
const CARD_MAP: Record<string, string> = { openbank: "OpenBank", amex: "Amex", invex: "Invex" }
const INV_TYPES = ["fund", "stock", "fondo", "accion"]
// NB: "pago" is intentionally NOT here — in Spanish it means "payment" (expense-
// leaning), and "pago tarjeta" is a card payment. Real income uses income/salary/etc.
const INCOME_KEYWORDS = ["income", "salary", "ingreso", "treeline", "usd"]
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

// Sort dict entries by key length DESC so a longer key like "gas natural"
// is tested before the shorter "gas" — otherwise multi-word categories lose.
function sortedEntries(d: Record<string, string>): Array<[string, string]> {
  return Object.entries(d).sort((a, b) => b[0].length - a[0].length)
}
const CATS_SORTED = sortedEntries(CATS)

function guessCategory(text: string, learned?: Record<string, string>): string {
  const lower = text.toLowerCase()
  // User overrides come first — most specific. Also length-sorted.
  if (learned) {
    for (const [k, v] of sortedEntries(learned)) {
      if (lower.includes(k)) return v
    }
  }
  for (const [k, v] of CATS_SORTED) {
    if (lower.includes(k)) return v
  }
  return "Other"
}

export type ParsedEntry =
  | { entry_type: "expense";    name: string; amount: number; date: string; cat: string; note?: string; accountId?: string }
  | { entry_type: "income";     name: string; amount: number; date: string; note?: string; accountId?: string }
  | { entry_type: "cc";         name: string; amount: number; date: string; cat: string; card: string; installments: number }
  | { entry_type: "investment"; name: string; amount: number; date: string; gf: boolean; inv_type: "fund" | "stock" }

// Derive lowercase aliases for an account name, skipping tokens that collide
// with card names (e.g. "openbank") so "OpenBank Savings" matches on "savings".
function accountAliases(name: string): string[] {
  const lower = name.toLowerCase().trim()
  const out = new Set<string>([lower, lower.replace(/\s+/g, "")])
  for (const w of lower.split(/\s+/)) {
    if (w.length >= 4 && !CC_CARDS.includes(w)) out.add(w)
  }
  return [...out]
}

export function parseEntry(
  raw: string,
  learned?: Record<string, string>,
  accounts?: Array<{ id: string; name: string }>,
): ParsedEntry | { error: string } {
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

  // Resolve a named account (longest alias first so "openbank savings" beats "savings").
  // Build [alias, accountId] pairs, sorted by alias length DESC.
  const acctPairs: Array<[string, string]> = []
  for (const a of accounts ?? []) for (const al of accountAliases(a.name)) acctPairs.push([al, a.id])
  acctPairs.sort((p, q) => q[0].length - p[0].length)
  const matchedAcct = acctPairs.find(([al]) => lower.includes(al))
  const accountId = matchedAcct?.[1]
  const acctAliasSet = new Set(acctPairs.map(([al]) => al))

  // Name = tokens minus numbers/cards/keywords/account-aliases
  const nameTokens = tokens.filter(t =>
    !/^\d/.test(t) && !CC_CARDS.includes(t) && !STRIP_TOKENS.has(t) && !acctAliasSet.has(t))
  const name = nameTokens.join(" ").trim() || text.split(/\s+/).slice(1, 3).join(" ")

  const isIncome = INCOME_KEYWORDS.some(k => lower.includes(k))
  const isInvestment = INV_KEYWORDS.some(k => lower.includes(k))
  const isDolarApp = lower.includes("dolarapp")
  const ccCard = CC_CARDS.find(c => lower.includes(c))
  // Naming an account means cash left that account → treat as expense/income, not a card charge.
  const isCC = !!ccCard && !isInvestment && !accountId

  // Installments: "3 msi" / "12 meses"
  const instMatch = text.match(/(\d+)\s*(msi|meses|mensualidades|installments)/i)
  const installments = instMatch ? parseInt(instMatch[1]) : 1

  if (isIncome) {
    return { entry_type: "income", name: name || "Income", amount, date, accountId }
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
      cat: guessCategory(text, learned),
      card: CARD_MAP[ccCard],
      installments,
    }
  }
  // Default: direct expense
  return {
    entry_type: "expense", name, amount, date,
    cat: guessCategory(text, learned),
    note: isDolarApp ? "DolarApp" : undefined,
    accountId,
  }
}
