import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { CCCharge, Investment } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ── Design tokens — v2 (fintech bright, dark mode) ──────────────────
 * Punchier surfaces, brighter accents, gradient-ready hero treatments.
 * Old token names are kept as aliases for back-compat while we migrate.
 */
export const C = {
  // Surfaces — deeper black + lifted cards for more contrast
  bg:       "#0B0D11",
  surface:  "#15181F",
  card:     "#1A1D26",
  cardHi:   "#22262F",
  cardSoft: "#15181F",
  elevated: "#1F2230",  // for hero cards
  border:   "#2A2E3B",  // more visible than before
  borderHi: "#3A3F50",

  // Text scale
  text:    "#F2F4F8",
  strong:  "#FFFFFF",
  muted:   "#8A8D99",
  dim:     "#52555F",

  // Brand + status accents (more saturated)
  green:     "#04D77F", greenSoft: "#6AE8AF", greenDim: "#0E2A1E",
  red:       "#FF5B6B", redDim:    "#2A1018",
  blue:      "#47CBFF", blueDim:   "#0E2034",
  amber:     "#FF9D68", amberDim:  "#2A1A10",
  purple:    "#7B61FF", purpleDim: "#1A1530",
  pink:      "#FF6BAA", pinkDim:   "#2A1020",
  teal:      "#5BD1B0", tealDim:   "#0E2624",
} as const

/* ── Gradients ───────────────────────────────────────────────────── */
export const G = {
  hero:    "linear-gradient(135deg, #7B61FF 0%, #FF6BAA 100%)",
  income:  "linear-gradient(135deg, #04D77F 0%, #47CBFF 100%)",
  spent:   "linear-gradient(135deg, #FF5B6B 0%, #FF9D68 100%)",
  invest:  "linear-gradient(135deg, #47CBFF 0%, #7B61FF 100%)",
  cards:   "linear-gradient(135deg, #FF9D68 0%, #FF6BAA 100%)",
  card:    "linear-gradient(180deg, #1F2230 0%, #15181F 100%)",  // subtle vertical
} as const

/* ── Motion ──────────────────────────────────────────────────────── */
export const M = {
  fast:  150,
  base:  250,
  slow:  400,
  ease:  "cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const

// Fallback only — runtime should always use state.fxRate from /api/fx
// (live rate, refreshed hourly, cached in Redis).
export const FX_FALLBACK = 17.3

export const CAT_COLORS: Record<string, string> = {
  "Food & Dining":  "#FF9D68",
  "Transport":      "#47CBFF",
  "Housing":        "#04D77F",
  "Health":         "#EF7D98",
  "Entertainment":  "#A996FF",
  "Shopping":       "#FFC83D",
  "Card Payments":  "#FF5B6B",
  "Pets":           "#5BD1B0",
  "Groceries":      "#7CDCA6",
  "Furniture":      "#D4A373",   // warm tan
  "Gifts":          "#FF6BAA",   // rose
  "House Supplies": "#9B7FE0",   // lavender
  "Clothes":        "#FFD166",   // mustard
  "GF":             "#E86FC4",   // magenta — Mariana
  "Other":          "#8E8F95",
}
export const CATS = Object.keys(CAT_COLORS) as Array<keyof typeof CAT_COLORS>

export const CC_CARDS = ["OpenBank", "Amex", "Invex"] as const

export interface Bucket {
  id: "my-fund" | "my-stock" | "gf-fund" | "gf-stock"
  label: string
  gf: boolean
  type: "fund" | "stock"
  color: string
  dim: string
}
export const BUCKETS: Bucket[] = [
  { id: "my-fund",  label: "My Funds",  gf: false, type: "fund",  color: C.blue,   dim: C.blueDim },
  { id: "my-stock", label: "My Stocks", gf: false, type: "stock", color: C.green,  dim: C.greenDim },
  { id: "gf-fund",  label: "GF Funds",  gf: true,  type: "fund",  color: C.purple, dim: C.purpleDim },
  { id: "gf-stock", label: "GF Stocks", gf: true,  type: "stock", color: C.pink,   dim: C.pinkDim },
]
export function getBucket(inv: Investment): Bucket {
  return BUCKETS.find(b => b.gf === inv.gf && b.type === inv.inv_type) ?? BUCKETS[1]
}

/* ── Formatters ───────────────────────────────────────────────────── */
export function fmt(n: number, dec = 0): string {
  return "$" + (+n).toLocaleString("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

export function fmtUSD(n: number, dec = 2): string {
  return "$" + n.toLocaleString("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
export function fmtDate(str: string): string {
  const [, m, d] = str.split("-")
  return MONTHS[parseInt(m) - 1] + " " + parseInt(d)
}

export function today(): string {
  return new Date().toISOString().split("T")[0]
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function inMonth(dateStr: string, y: number, m: number): boolean {
  const [dy, dm] = dateStr.split("-").map(Number)
  return dy === y && dm - 1 === m
}

/** Tiny haptic tap on devices that support it (Android Chrome). No-op elsewhere. */
export function buzz(ms = 10) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms)
  } catch { /* ignore */ }
}

export function nanoid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

/* ── Expand installment CC charges into monthly slices ────────────── */
export type CCSlice = CCCharge & { installmentOf?: string; installmentN?: number }
export function expandCC(cc: CCCharge[]): CCSlice[] {
  const out: CCSlice[] = []
  for (const e of cc) {
    if (e.installments && e.installments > 1) {
      const slice = Math.round(e.amount / e.installments)
      const [y, mo] = e.date.split("-").map(Number)
      for (let i = 0; i < e.installments; i++) {
        const d = new Date(y, mo - 1 + i, 1)
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
        out.push({ ...e, id: `${e.id}_${i}`, amount: slice, date: dateStr, installmentOf: e.id, installmentN: i + 1 })
      }
    } else {
      out.push(e)
    }
  }
  return out
}
