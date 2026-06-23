export type Category =
  | "Food & Dining" | "Transport" | "Housing" | "Health"
  | "Entertainment" | "Shopping" | "Card Payments" | "Pets"
  | "Groceries" | "Furniture" | "Gifts" | "House Supplies"
  | "Clothes" | "Other"

export type CCCard = "OpenBank" | "Amex" | "Invex"
export type InvType = "fund" | "stock"

export interface Expense {
  id: string
  name: string
  amount: number
  cat: Category
  date: string
  note?: string
}

export interface Income {
  id: string
  name: string
  amount: number  // USD
  date: string
  note?: string
}

export interface CCCharge {
  id: string
  name: string
  amount: number
  date: string
  cat: Category
  card: CCCard
  installments?: number
}

export interface Investment {
  id: string
  name: string
  amount: number
  date: string
  note?: string
  gf: boolean
  inv_type: InvType
  historical?: boolean
  purchase_price?: number  // USD at buy time (stocks)
  purchase_nav?: number    // MXN per-share NAV at buy time (funds)
}

export interface StockPrice {
  price: number
  currency: string
  updatedAt: string
}

export interface Budget {
  cat: Category
  limitMXN: number
}

/** A credit-card statement period.
 *  - `closingBalance` is the amount actually printed on the bank statement.
 *  - `paid` is the cumulative amount you've paid against it across one or more payments.
 *  - `period` is the "YYYY-MM" of the cycle that CLOSED — typically the cutoff month. */
export interface Statement {
  id: string
  card: CCCard | string
  period: string         // "YYYY-MM"
  closingBalance: number // MXN — the "pay this to avoid interest" headline number
  totalOwed?: number     // MXN — the "saldo deudor total" (includes future MSI tail);
                         //   displayed as secondary info for context, NOT what gets paid.
  pagoMinimo?: number    // MXN — the minimum payment required to stay current (interest accrues on
                         //   the rolled-over balance). Used to quick-fill the Record payment form.
  paid: number           // cumulative paid against this statement (MXN)
  dueOn?: string         // YYYY-MM-DD
  notes?: string
}

/** Monthly auto-fire template. Cron processes on dayOfMonth each month
 *  if `active` and `lastFired !== thisPeriod`. */
export interface Recurring {
  id: string
  name: string
  type: "expense" | "income" | "cc" | "investment"
  amount: number
  cat?: Category
  card?: CCCard | string
  gf?: boolean
  inv_type?: InvType
  dayOfMonth: number      // 1..31, clamped to month length
  active: boolean
  lastFired?: string      // "YYYY-MM" of last firing
  note?: string
}

/** Locked-in future MSI / financing installment line.
 *  E.g. "IKEA 4 more @ $2,807.96/mo on Invex." Used by forecasting UI;
 *  decremented manually as installments hit (or via Mark paid). */
export interface FutureObligation {
  id: string
  card: CCCard | string
  description: string
  monthlyAmount: number     // MXN per remaining installment
  monthsRemaining: number   // includes the next firing
  startMonth?: string       // "YYYY-MM" of next installment; defaults to current
  notes?: string
}

/** A liquid account (cash, savings, US tax-advantaged, etc.), in its own currency.
 *  2.0 bi-national: net worth aggregates these + investments − card debt. */
export interface Account {
  id: string
  name: string
  currency: "MXN" | "USD"
  balance: number
  kind: "checking" | "savings" | "hysa" | "hsa" | "roth" | "brokerage" | "cash" | "other"
  apr?: number        // optional yield (e.g. OpenBank 13%)
  note?: string
}

/** A forward-looking target with progress. kind drives how `current` is computed/shown. */
export interface Goal {
  id: string
  title: string
  kind: "debt-free" | "savings" | "custom"
  target: number             // target amount (for savings/custom) — debt-free target = 0 debt
  currency: "MXN" | "USD"
  current?: number           // manual current (savings/custom); debt-free is auto from card debt
  targetDate?: string        // YYYY-MM-DD
  note?: string
}

export interface AppState {
  expenses: Expense[]
  income: Income[]
  cc: CCCharge[]
  investments: Investment[]
  settled: Record<string, number>
  prices: Record<string, StockPrice>
  budgets: Budget[]
  fxRate: number
  statements?: Statement[]
}
