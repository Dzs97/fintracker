import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { CCCharge } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmt(n: number, dec = 0): string {
  return "$" + n.toLocaleString("es-MX", {
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

export function fmtDate(str: string): string {
  const [, m, d] = str.split("-")
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return months[parseInt(m) - 1] + " " + parseInt(d)
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

// Expand installment CC charges into monthly slices
export function expandCC(cc: CCCharge[]): (CCCharge & { installmentOf?: string; installmentN?: number })[] {
  const out: (CCCharge & { installmentOf?: string; installmentN?: number })[] = []
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

export const CAT_COLORS: Record<string, string> = {
  "Food & Dining": "#FF7A5C",
  "Transport":     "#5B9FFF",
  "Housing":       "#00E5A0",
  "Health":        "#FF6BAA",
  "Entertainment": "#A78BFA",
  "Shopping":      "#FFB547",
  "Card Payments": "#FF5B6B",
  "Pets":          "#F59E0B",
  "Groceries":     "#34D399",
  "Other":         "#6B6B8A",
}
