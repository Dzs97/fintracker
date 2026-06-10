export type Category =
  | "Food & Dining" | "Transport" | "Housing" | "Health"
  | "Entertainment" | "Shopping" | "Card Payments" | "Pets"
  | "Groceries" | "Other"

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
  closingBalance: number // MXN — from the actual bank statement
  paid: number           // cumulative paid against this statement (MXN)
  dueOn?: string         // YYYY-MM-DD
  notes?: string
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
