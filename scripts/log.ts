#!/usr/bin/env node
/**
 * fintracker log helper
 * Usage: npx tsx scripts/log.ts '<natural language entry>'
 *
 * Examples:
 *   npx tsx scripts/log.ts "782 ubereats openbank"
 *   npx tsx scripts/log.ts "625 usd income treeline"
 *   npx tsx scripts/log.ts "750 nubank stock mine"
 *   npx tsx scripts/log.ts "1500 fintual fund gf"
 *   npx tsx scripts/log.ts "150 coffee dolarapp"
 *
 * Claude Code will call this script directly after parsing
 * your natural language message into structured fields.
 */

import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

const CATS: Record<string, string> = {
  uber: "Transport", taxi: "Transport", metro: "Transport", gas: "Transport",
  ubereats: "Food & Dining", restaurant: "Food & Dining", lunch: "Food & Dining",
  coffee: "Food & Dining", cafe: "Food & Dining", dinner: "Food & Dining",
  super: "Groceries", groceries: "Groceries", walmart: "Groceries", sumesa: "Groceries",
  amazon: "Shopping", liverpool: "Shopping", zara: "Shopping",
  netflix: "Entertainment", spotify: "Entertainment", cinema: "Entertainment",
  gym: "Health", doctor: "Health", farmacia: "Health",
  rent: "Housing", airbnb: "Housing",
  sakura: "Pets", veterinaria: "Pets", petco: "Pets",
  card: "Card Payments",
}

const CC_CARDS = ["openbank", "amex", "invex"]
const INV_TYPES = ["fund", "stock", "fondo", "accion"]
const INCOME_KEYWORDS = ["income", "salary", "ingreso", "pago", "treeline", "usd"]
const INV_KEYWORDS = ["fintual", "nubank", "nu", "gbm", "stock", "fund", "invest", "compra"]

function guessCategory(text: string): string {
  const lower = text.toLowerCase()
  for (const [k, v] of Object.entries(CATS)) {
    if (lower.includes(k)) return v
  }
  return "Other"
}

function today(): string {
  return new Date().toISOString().split("T")[0]
}

async function main() {
  const raw = process.argv.slice(2).join(" ").trim()
  if (!raw) {
    console.error("Usage: npx tsx scripts/log.ts '<entry>'")
    process.exit(1)
  }

  const lower = raw.toLowerCase()
  const tokens = lower.split(/\s+/)

  // Extract amount (first number found)
  const amountMatch = raw.match(/(\d+(?:\.\d+)?)/)
  if (!amountMatch) { console.error("No amount found in:", raw); process.exit(1) }
  const amount = parseFloat(amountMatch[1])

  // Extract date if provided (YYYY-MM-DD or "jun 4", "june 4" etc)
  let date = today()
  const dateMatch = raw.match(/(\d{4}-\d{2}-\d{2})/)
  if (dateMatch) date = dateMatch[1]
  const monthMatch = raw.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})/i)
  if (monthMatch) {
    const months: Record<string,string> = {jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12"}
    const y = new Date().getFullYear()
    date = `${y}-${months[monthMatch[1].toLowerCase()]}-${String(parseInt(monthMatch[2])).padStart(2,"0")}`
  }

  // Remove amount and date from name reconstruction
  const nameTokens = tokens.filter(t =>
    !t.match(/^\d/) && !CC_CARDS.includes(t) &&
    !["gf","mine","me","stock","fund","fondo","usd","mxn","income","salary","invest","historical"].includes(t) &&
    !Object.keys({jan:1,feb:1,mar:1,apr:1,may:1,jun:1,jul:1,aug:1,sep:1,oct:1,nov:1,dec:1}).includes(t)
  )
  const name = nameTokens.join(" ").trim() || raw.split(/\s+/).slice(1, 3).join(" ")

  // ── Detect entry type ──
  const isIncome = INCOME_KEYWORDS.some(k => lower.includes(k))
  const isInvestment = INV_KEYWORDS.some(k => lower.includes(k))
  const isDolarApp = lower.includes("dolarapp")
  const ccCard = CC_CARDS.find(c => lower.includes(c))
  const isCC = !!ccCard && !isInvestment

  // Installments: "3 msi" or "12 mensualidades"
  const installMatch = raw.match(/(\d+)\s*(msi|meses|mensualidades|installments)/i)
  const installments = installMatch ? parseInt(installMatch[1]) : 1

  // Investment fields
  const isGF = lower.includes("gf") || lower.includes(" her ")
  const invTypeRaw = INV_TYPES.find(t => lower.includes(t))
  const inv_type = (invTypeRaw === "fondo" || invTypeRaw === "fund") ? "fund" : "stock"

  let payload: Record<string, unknown>

  if (isIncome) {
    payload = { entry_type: "income", name: name || "Income", amount, date }
  } else if (isInvestment) {
    payload = { entry_type: "investment", name: nameTokens.find(t => INV_KEYWORDS.includes(t)) ?? name, amount, date, gf: isGF, inv_type }
  } else if (isCC) {
    payload = {
      entry_type: "cc", name, amount, date,
      cat: guessCategory(raw),
      card: CC_CARDS.find(c => lower.includes(c))!.charAt(0).toUpperCase() + CC_CARDS.find(c => lower.includes(c))!.slice(1),
      installments,
    }
    // Capitalise card name properly
    const rawCard = CC_CARDS.find(c => lower.includes(c))!
    const cardMap: Record<string,string> = { openbank: "OpenBank", amex: "Amex", invex: "Invex" }
    ;(payload as Record<string,unknown>).card = cardMap[rawCard]
  } else {
    // Direct expense (DolarApp or no card mentioned)
    payload = {
      entry_type: "expense", name, amount, date,
      cat: guessCategory(raw),
      note: isDolarApp ? "DolarApp" : undefined,
    }
  }

  console.log("\n📋 Parsed entry:")
  console.log(JSON.stringify(payload, null, 2))

  const res = await fetch(`${BASE_URL}/api/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("❌ Error:", err)
    process.exit(1)
  }

  const data = await res.json()
  console.log("\n✅ Logged:", data.entry.name, `$${data.entry.amount}`)
}

main().catch(console.error)
