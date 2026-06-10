import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { CCCharge, Investment } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ── Design tokens (mirror of app/theme.js from the handoff) ──────── */
export const C = {
  bg:       "#0E0F12",
  surface:  "#16181C",
  card:     "#1C1E23",
  cardHi:   "#232529",
  border:   "#2A2C32",
  borderHi: "#34373E",

  text:    "#F2F2F5",
  strong:  "#FFFFFF",
  muted:   "#8E8F95",
  dim:     "#5B5D62",

  green:     "#04D77F", greenSoft: "#6AE8AF", greenDim: "#0C2A20",
  red:       "#FF5B6B", redDim:   "#2A1014",
  blue:      "#47CBFF", blueDim:  "#0C1E2A",
  amber:     "#FF9D68", amberDim: "#2A180F",
  purple:    "#A996FF", purpleDim:"#181230",
  teal:      "#5BD1B0", tealDim:  "#0C2420",
  pink:      "#EF7D98", pinkDim:  "#2A1018",
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
