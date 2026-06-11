"use client"
/**
 * FinTracker dashboard — faithful port of the design handoff
 * (design_handoff_finance_tracker), API-backed via /api/* (Upstash Redis).
 */
import { useCallback, useEffect, useState } from "react"
import type { AppState } from "@/types"
import {
  C, FX_FALLBACK, CAT_COLORS, CATS, CC_CARDS, BUCKETS, getBucket,
  expandCC, fmt, fmtDate, today, buzz,
} from "@/lib/utils"
import { Icon } from "@/components/Icon"
import {
  Card, Tag, BucketTag, Label, Empty, SearchBar, ToggleRow,
  EntryRow, FormSheet, FAB, inp, lbl,
} from "@/components/ui"
import { SparkBar, LineChart, Donut } from "@/components/charts"
import { MapsEditor } from "@/components/MapsEditor"
import { computeCycle, partitionByCycle, fmtDueLabel, type CardConfig } from "@/lib/cardCycles"
import { StatementsPanel } from "@/components/StatementsPanel"
import { QuickLogSheet } from "@/components/QuickLogSheet"
import { EditEntrySheet } from "@/components/EditEntrySheet"
import { TopBar } from "@/components/TopBar"
import { BottomNav, type NavTab } from "@/components/BottomNav"
import { HomeScreen, type HomeNavTarget } from "@/components/HomeScreen"
import { CardTile } from "@/components/CardTile"
import { HomeSkeleton, Shimmer } from "@/components/Skeleton"
import { AssetDetailSheet, type AssetSelection } from "@/components/AssetDetailSheet"
import type { Expense, Income, CCCharge, Recurring, FutureObligation } from "@/types"

const TABS = [
  { id: "Overview",    label: "Overview" },
  { id: "Cards",       label: "Cards" },
  { id: "Expenses",    label: "Expenses" },
  { id: "Income",      label: "Income" },
  { id: "Investments", label: "Invest" },
] as const
type TabId = typeof TABS[number]["id"]

async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export default function Dashboard() {
  const [state, setState] = useState<AppState | null>(null)
  const [tab, setTab] = useState<TabId>("Overview")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [heroFlash, setHeroFlash] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [quickAdd, setQuickAdd] = useState<null | "expense" | "income" | "cc" | "investment">(null)
  const [activeInvTab, setActiveInvTab] = useState<"portfolio" | "pl" | "history" | "maps">("portfolio")
  const [tickers, setTickers] = useState<Record<string, string>>({})
  const [funds, setFunds] = useState<Record<string, string>>({})
  const [splits, setSplits] = useState<Record<string, Array<{ name: string; weight: number; inv_type?: "fund" | "stock" }>>>({})
  const [cardConfig, setCardConfig] = useState<Record<string, CardConfig>>({})
  const [recurring, setRecurring] = useState<Recurring[]>([])
  const [obligations, setObligations] = useState<FutureObligation[]>([])
  const [fxSource, setFxSource] = useState<string | undefined>(undefined)
  // Category filter applied to the Expenses tab (set from Home drill-downs)
  const [catFilter, setCatFilter] = useState<string | null>(null)
  // Asset drill-down sheet (opened from P&L cards)
  const [assetDetail, setAssetDetail] = useState<AssetSelection | null>(null)
  // Bucket filter on the Invest tab (set by tapping a hero bucket tile)
  const [bucketFilter, setBucketFilter] = useState<string | null>(null)
  const handleHomeNav = (target: HomeNavTarget) => {
    if (typeof target === "string") {
      setCatFilter(null)
      if (target === "expenses") setTab("Expenses")
      else if (target === "income") setTab("Income")
      else if (target === "cards") setTab("Cards")
      else if (target === "invest") setTab("Investments")
    } else if (target.kind === "category") {
      setCatFilter(target.cat); setTab("Expenses")
    }
  }
  const [priceBusy, setPriceBusy] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [editing, setEditing] = useState<
    | { kind: "expense"; row: Expense }
    | { kind: "income";  row: Income }
    | { kind: "cc";      row: CCCharge }
    | null
  >(null)
  // Per-position benchmark returns: key = "Name||gf|me" → percent change of index since first buy
  const [bench, setBench] = useState<Record<string, { symbol: string; pct: number }>>({})

  // Undo toast: stash the deleted entity + a restore thunk
  type Toast = { msg: string; restore: () => Promise<void> } | null
  const [toast, setToast] = useState<Toast>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }
  })
  const [search, setSearch] = useState({ exp: "", inc: "", cc: "", inv: "" })

  const [form, setForm] = useState({
    expName: "", expAmt: "", expCat: "Food & Dining", expDate: today(), expNote: "",
    incName: "", incAmt: "", incDate: today(), incNote: "",
    ccName: "", ccAmt: "", ccDate: today(), ccCat: "Food & Dining", ccCard: "OpenBank" as (typeof CC_CARDS)[number], ccInstallments: 1,
    invName: "", invAmt: "", invDate: today(), invNote: "", invGf: false, invType: "fund" as "fund" | "stock",
  })
  const upd = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))

  const triggerFlash = () => { setHeroFlash(true); setTimeout(() => setHeroFlash(false), 600) }

  // One round trip for everything. `silent` skips the refresh spinner —
  // used for background reconciles after optimistic mutations.
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setRefreshing(true)
    try {
      const d = await api<{
        state: AppState
        fx: { rate: number; baseRate: number; source?: string }
        tickers: Record<string, string>
        funds: Record<string, string>
        splits: typeof splits
        cardConfig: Record<string, CardConfig>
        recurring: Recurring[]
        obligations: FutureObligation[]
      }>("/api/state")
      setTickers(d.tickers)
      setFunds(d.funds)
      setSplits(d.splits)
      setCardConfig(d.cardConfig)
      setRecurring(d.recurring)
      setObligations(d.obligations)
      setFxSource(d.fx.source)
      setState({ ...d.state, fxRate: d.fx.rate ?? FX_FALLBACK })
    } finally {
      setLoading(false)
      if (!opts?.silent) setTimeout(() => setRefreshing(false), 600)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setShowForm(false); setQuickAdd(null) }, [tab])

  // Lazy-load benchmark returns when entering Investments > P&L
  useEffect(() => {
    if (tab !== "Investments" || activeInvTab !== "pl") return
    if (!state) return
    // Build distinct (name, type, earliest-buy) groups
    type Pos = { key: string; symbol: string; earliest: string }
    const positions = new Map<string, Pos>()
    for (const i of state.investments) {
      const key = `${i.name}||${i.gf ? "gf" : "me"}`
      const symbol = i.inv_type === "stock" ? "SPY" : "^MXX"
      const cur = positions.get(key)
      if (!cur || i.date < cur.earliest) positions.set(key, { key, symbol, earliest: i.date })
    }
    // Skip already-fetched + fetch missing in parallel
    const missing = [...positions.values()].filter(p => !bench[p.key])
    if (missing.length === 0) return
    Promise.all(missing.map(async p => {
      try {
        const r = await api<{ pct: number; symbol: string }>(`/api/benchmark?symbol=${encodeURIComponent(p.symbol)}&from=${p.earliest}`)
        return [p.key, { symbol: p.symbol, pct: r.pct }] as const
      } catch { return null }
    })).then(rs => {
      const updates: Record<string, { symbol: string; pct: number }> = {}
      for (const r of rs) if (r) updates[r[0]] = r[1]
      if (Object.keys(updates).length) setBench(b => ({ ...b, ...updates }))
    })
  }, [tab, activeInvTab, state, bench])

  if (loading || !state) {
    return (
      <div style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
        <div style={{ padding: "max(env(safe-area-inset-top, 16px), 16px) 16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <Shimmer width={38} height={38} radius={12} />
            <div style={{ flex: 1 }}>
              <Shimmer width={120} height={16} radius={6} />
              <Shimmer width={80} height={11} radius={4} style={{ marginTop: 6 }} />
            </div>
            <Shimmer width={38} height={38} radius={12} />
            <Shimmer width={38} height={38} radius={12} />
          </div>
          <Shimmer width={140} height={32} radius={100} />
        </div>
        <HomeSkeleton />
      </div>
    )
  }

  // Live FX rate from state (refreshed hourly via /api/fx).
  const FX = state.fxRate || FX_FALLBACK

  /* ── derived: month window ── */
  const { y: vy, m: vm } = viewMonth
  const moName = new Date(vy, vm, 1).toLocaleString("en-US", { month: "long" })
  const isCurrentMonth = () => { const n = new Date(); return n.getFullYear() === vy && n.getMonth() === vm }
  const shiftMonth = (d: number) => { const nd = new Date(vy, vm + d, 1); setViewMonth({ y: nd.getFullYear(), m: nd.getMonth() }) }
  const inMonth = (str: string) => { const [y, m] = str.split("-").map(Number); return y === vy && m - 1 === vm }

  const prevDate = new Date(vy, vm - 1, 1)
  const inPrevMonth = (str: string) => { const [y, m] = str.split("-").map(Number); return m - 1 === prevDate.getMonth() && y === prevDate.getFullYear() }

  const ccExpanded = expandCC(state.cc)
  const monthExp = state.expenses.filter(e => inMonth(e.date))
  const monthInc = state.income.filter(e => inMonth(e.date))
  const monthInv = state.investments.filter(e => inMonth(e.date))
  const monthCC  = ccExpanded.filter(e => inMonth(e.date))

  const totalExpMXN  = monthExp.reduce((s, e) => s + e.amount, 0)
  const totalIncUSD  = monthInc.reduce((s, e) => s + e.amount, 0)
  const totalIncMXN  = totalIncUSD * FX
  const totalInvAllTime = state.investments.reduce((s, e) => s + e.amount, 0)
  const monthInvMXN  = monthInv.filter(e => !e.historical).reduce((s, e) => s + e.amount, 0)
  const monthCCTotal = monthCC.reduce((s, e) => s + e.amount, 0)

  const prevIncMXN = state.income.filter(e => inPrevMonth(e.date)).reduce((s, e) => s + e.amount * FX, 0)
  const prevExpMXN = state.expenses.filter(e => inPrevMonth(e.date)).reduce((s, e) => s + e.amount, 0)
  const prevInvMXN = state.investments.filter(e => inPrevMonth(e.date) && !e.historical).reduce((s, e) => s + e.amount, 0)
  const prevCash = prevIncMXN - prevExpMXN - prevInvMXN

  const ccPoolByCard: Record<string, number> = {}
  CC_CARDS.forEach(card => {
    const raw = state.cc.filter(e => e.card === card).reduce((s, e) => s + e.amount, 0)
    ccPoolByCard[card] = Math.max(0, raw - (state.settled[card] ?? 0))
  })
  const ccPoolTotal = Object.values(ccPoolByCard).reduce((s, v) => s + v, 0)
  const currentCash = totalIncMXN - totalExpMXN - monthInvMXN
  const ccWarning = ccPoolTotal > currentCash * 0.8

  const cashDelta = prevCash === 0 ? null : ((currentCash - prevCash) / Math.abs(prevCash) * 100)
  const deltaLabel = cashDelta === null ? "" : (cashDelta >= 0 ? "↑" : "↓") + Math.abs(cashDelta).toFixed(0) + "% vs last mo"
  const deltaColor = cashDelta === null ? C.muted : cashDelta >= 0 ? C.green : C.red

  const catTotals: Record<string, number> = {}
  monthExp.forEach(e => { catTotals[e.cat] = (catTotals[e.cat] ?? 0) + e.amount })
  monthCC.forEach(e  => { catTotals[e.cat] = (catTotals[e.cat] ?? 0) + e.amount })
  const catGrand = Object.values(catTotals).reduce((s, v) => s + v, 0)

  // Previous-month totals per category for delta display
  const catPrev: Record<string, number> = {}
  state.expenses.filter(e => inPrevMonth(e.date)).forEach(e => { catPrev[e.cat] = (catPrev[e.cat] ?? 0) + e.amount })
  ccExpanded.filter(e => inPrevMonth(e.date)).forEach(e => { catPrev[e.cat] = (catPrev[e.cat] ?? 0) + e.amount })

  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(vy, vm - 5 + i, 1)
    return { m: d.getMonth(), y: d.getFullYear(), label: d.toLocaleString("en-US", { month: "short" }) }
  })
  const incByMonth = last6.map(p => ({
    label: p.label,
    v: state.income.filter(e => { const d = new Date(e.date); return d.getMonth() === p.m && d.getFullYear() === p.y })
      .reduce((s, e) => s + e.amount * FX, 0),
  }))
  const expByMonth = last6.map(p => ({
    label: p.label,
    v: [...state.expenses, ...ccExpanded]
      .filter(e => { const d = new Date(e.date); return d.getMonth() === p.m && d.getFullYear() === p.y })
      .reduce((s, e) => s + e.amount, 0),
  }))
  const invCumLine = last6.map(p => ({
    label: p.label,
    v: state.investments
      .filter(e => { const d = new Date(e.date); return d.getFullYear() < p.y || (d.getFullYear() === p.y && d.getMonth() <= p.m) })
      .reduce((s, e) => s + e.amount, 0),
  }))

  // 6-month series per category (for inline sparkbar). Same buckets as
  // the global 6-month spending chart so colors / x-labels align.
  const catSeries: Record<string, number[]> = {}
  last6.forEach((p, i) => {
    const periodExp = state.expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === p.m && d.getFullYear() === p.y })
    const periodCC  = ccExpanded.filter(e => { const d = new Date(e.date); return d.getMonth() === p.m && d.getFullYear() === p.y })
    for (const e of [...periodExp, ...periodCC]) {
      if (!catSeries[e.cat]) catSeries[e.cat] = Array(6).fill(0)
      catSeries[e.cat][i] += e.amount
    }
  })

  // Cumulative net (income − expenses) at end of each month.
  // Investments don't reduce this — they're moved-aside money, not lost.
  const netWorthLine = last6.map(p => {
    const periodEnd = new Date(p.y, p.m + 1, 0)
    const inWindow = (d: Date) => d <= periodEnd
    const incCum = state.income
      .filter(e => inWindow(new Date(e.date)))
      .reduce((s, e) => s + e.amount * FX, 0)
    const expCum = state.expenses
      .filter(e => inWindow(new Date(e.date)))
      .reduce((s, e) => s + e.amount, 0)
    return { label: p.label, v: Math.max(0, incCum - expCum) }
  })

  // Live investment value vs cost (for the P&L delta on top of savings).
  // Stocks: cost is MXN, price is USD → multiply by FX. Funds: both MXN.
  // If we can't compute shares (no purchase_price/_nav), fall back to cost
  // so the entry contributes 0 P&L (rather than nuking the total).
  const investmentCost  = state.investments.reduce((s, e) => s + e.amount, 0)
  const investmentValue = state.investments.reduce((s, e) => {
    const p = state.prices?.[e.name]
    if (e.inv_type === "stock" && p && e.purchase_price && e.purchase_price > 0) {
      const shares = e.amount / (e.purchase_price * FX)
      return s + shares * p.price * FX
    }
    if (e.inv_type === "fund" && p && e.purchase_nav && e.purchase_nav > 0) {
      const shares = e.amount / e.purchase_nav
      return s + shares * p.price
    }
    return s + e.amount
  }, 0)
  const investmentPL = investmentValue - investmentCost

  const invByName: Record<string, { name: string; gf: boolean; cost: number; shares: number }> = {}
  state.investments.filter(i => i.inv_type === "stock").forEach(i => {
    const key = `${i.name}||${i.gf ? "gf" : "me"}`
    if (!invByName[key]) invByName[key] = { name: i.name, gf: i.gf, cost: 0, shares: 0 }
    invByName[key].cost += i.amount
    if (i.purchase_price) invByName[key].shares += i.amount / (i.purchase_price * FX)
  })

  // Funds: shares = cost_MXN / purchase_nav (NAV is in MXN, so no FX)
  const fundByName: Record<string, { name: string; gf: boolean; cost: number; shares: number; uncoveredCost: number }> = {}
  state.investments.filter(i => i.inv_type === "fund").forEach(i => {
    const key = `${i.name}||${i.gf ? "gf" : "me"}`
    if (!fundByName[key]) fundByName[key] = { name: i.name, gf: i.gf, cost: 0, shares: 0, uncoveredCost: 0 }
    fundByName[key].cost += i.amount
    if (i.purchase_nav && i.purchase_nav > 0) fundByName[key].shares += i.amount / i.purchase_nav
    else fundByName[key].uncoveredCost += i.amount
  })
  const bucketTotals: Record<string, number> = {}
  BUCKETS.forEach(b => { bucketTotals[b.id] = state.investments.filter(i => i.gf === b.gf && i.inv_type === b.type).reduce((s, i) => s + i.amount, 0) })
  // True when (gf, type) matches the active Invest bucket filter (or no filter)
  const matchesBucket = (gf: boolean, type: "fund" | "stock") => {
    if (!bucketFilter) return true
    const b = BUCKETS.find(x => x.id === bucketFilter)
    return !!b && b.gf === gf && b.type === type
  }
  const assetBreakdown = (gf: boolean, type: "fund" | "stock"): Array<[string, number]> => {
    const map: Record<string, number> = {}
    state.investments.filter(i => i.gf === gf && i.inv_type === type).forEach(i => { map[i.name] = (map[i.name] ?? 0) + i.amount })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }

  /* ── mutations ──
   * Pattern: apply the change to local state FIRST (instant UI), fire the
   * API call, then a silent background reconcile. If the API call throws,
   * the reconcile restores server truth. */
  const reconcile = () => load({ silent: true })
  const closeForms = () => { setShowForm(false); setQuickAdd(null) }
  const addExpense = async () => {
    if (!form.expName || !form.expAmt) return
    const entry = { id: `tmp-${Date.now()}`, name: form.expName, amount: parseFloat(form.expAmt), cat: form.expCat as Expense["cat"], date: form.expDate || today(), note: form.expNote }
    setState(s => s && ({ ...s, expenses: [...s.expenses, entry] }))
    setForm(f => ({ ...f, expName: "", expAmt: "", expNote: "" }))
    closeForms(); triggerFlash(); buzz()
    try { await api("/api/entries", "POST", { type: "expense", ...entry, id: undefined }) } finally { reconcile() }
  }
  const addIncome = async () => {
    if (!form.incName || !form.incAmt) return
    const entry = { id: `tmp-${Date.now()}`, name: form.incName, amount: parseFloat(form.incAmt), date: form.incDate || today(), note: form.incNote }
    setState(s => s && ({ ...s, income: [...s.income, entry] }))
    setForm(f => ({ ...f, incName: "", incAmt: "", incNote: "" }))
    closeForms(); triggerFlash(); buzz()
    try { await api("/api/entries", "POST", { type: "income", ...entry, id: undefined }) } finally { reconcile() }
  }
  const addCC = async () => {
    if (!form.ccName || !form.ccAmt) return
    const entry = { id: `tmp-${Date.now()}`, name: form.ccName, amount: parseFloat(form.ccAmt), date: form.ccDate || today(), cat: form.ccCat as CCCharge["cat"], card: form.ccCard, installments: Number(form.ccInstallments) || 1 }
    setState(s => s && ({ ...s, cc: [...s.cc, entry] }))
    setForm(f => ({ ...f, ccName: "", ccAmt: "", ccInstallments: 1 }))
    closeForms(); triggerFlash(); buzz()
    try { await api("/api/cc", "POST", { ...entry, id: undefined }) } finally { reconcile() }
  }
  const addInvestment = async () => {
    if (!form.invName || !form.invAmt) return
    // Investments may split server-side — show the un-split entry until reconcile
    const entry = { id: `tmp-${Date.now()}`, name: form.invName, amount: parseFloat(form.invAmt), date: form.invDate || today(), note: form.invNote, gf: form.invGf, inv_type: form.invType }
    setState(s => s && ({ ...s, investments: [...s.investments, entry] }))
    setForm(f => ({ ...f, invName: "", invAmt: "", invNote: "" }))
    closeForms(); triggerFlash(); buzz()
    try { await api("/api/investments", "POST", { ...entry, id: undefined }) } finally { reconcile() }
  }
  const delEntry = async (type: "expense" | "income", id: string) => {
    const row = (type === "expense" ? state.expenses : state.income).find(e => e.id === id)
    if (!row) return
    buzz()
    setState(s => s && (type === "expense"
      ? { ...s, expenses: s.expenses.filter(e => e.id !== id) }
      : { ...s, income: s.income.filter(e => e.id !== id) }))
    setToast({
      msg: `Deleted ${type}: ${row.name}`,
      restore: async () => {
        const { id: _drop, ...rest } = row
        await api("/api/entries", "POST", { type, ...rest })
        await load({ silent: true })
      },
    })
    try { await api("/api/entries", "DELETE", { type, id }) } catch { reconcile() }
  }
  const delCC = async (id: string) => {
    const row = state.cc.find(e => e.id === id)
    if (!row) return
    buzz()
    setState(s => s && ({ ...s, cc: s.cc.filter(e => e.id !== id) }))
    setToast({
      msg: `Deleted charge: ${row.name}`,
      restore: async () => {
        const { id: _drop, ...rest } = row
        await api("/api/cc", "POST", rest)
        await load({ silent: true })
      },
    })
    try { await api("/api/cc", "DELETE", { id }) } catch { reconcile() }
  }
  const delInv = async (id: string) => {
    const row = state.investments.find(e => e.id === id)
    if (!row) return
    buzz()
    setState(s => s && ({ ...s, investments: s.investments.filter(e => e.id !== id) }))
    setToast({
      msg: `Deleted: ${row.name}`,
      restore: async () => {
        // Bypass split rules on restore — submit the exact row back
        const { id: _drop, ...rest } = row
        await api("/api/investments", "POST", { ...rest, _skipSplit: true })
        await load({ silent: true })
      },
    })
    try { await api("/api/investments", "DELETE", { id }) } catch { reconcile() }
  }
  const settleCard = async (card: string) => {
    const pool = ccPoolByCard[card] ?? 0
    if (pool <= 0) return
    if (!confirm(`Settle ${card} — ${fmt(pool)} MXN?\n\nThis posts a real expense and zeros the unpaid pool.`)) return
    buzz(15)
    // Optimistic: bump settled locally so the pool zeroes instantly
    setState(s => s && ({ ...s, settled: { ...s.settled, [card]: (s.settled[card] ?? 0) + pool } }))
    triggerFlash()
    try { await api("/api/cc", "PATCH", { card }) } finally { reconcile() }
  }
  const updatePrice = async (ticker: string, price: number) => { await api("/api/investments", "PATCH", { ticker, price }); load() }
  const setTicker = async (name: string, ticker: string) => {
    await api("/api/prices", "PUT", { name, ticker })
    setTickers(t => {
      const next = { ...t }
      if (ticker) next[name] = ticker.toUpperCase(); else delete next[name]
      return next
    })
  }
  const refreshPrices = async () => {
    setPriceBusy(true)
    try {
      await Promise.all([api("/api/prices", "POST"), api("/api/funds", "POST")])
      await load()
    } finally { setPriceBusy(false) }
  }

  const doRefresh = () => { load() }

  /* ── inline forms ── */
  const expenseForm = () => (
    <FormSheet title="New expense" onSubmit={addExpense} submitLabel="Add expense" onCancel={closeForms} accent={C.red}>
      <label style={lbl}>Description</label>
      <input style={inp} value={form.expName} onChange={e => upd("expName", e.target.value)} placeholder="Coffee, rent…" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><label style={lbl}>Amount (MXN)</label><input style={inp} type="number" value={form.expAmt} onChange={e => upd("expAmt", e.target.value)} placeholder="0.00" min="0" /></div>
        <div><label style={lbl}>Date</label><input style={inp} type="date" value={form.expDate} onChange={e => upd("expDate", e.target.value)} /></div>
      </div>
      <label style={lbl}>Category</label>
      <select style={inp} value={form.expCat} onChange={e => upd("expCat", e.target.value)}>
        {CATS.map(c => <option key={c}>{c}</option>)}
      </select>
      <label style={lbl}>Note (optional)</label>
      <input style={inp} value={form.expNote} onChange={e => upd("expNote", e.target.value)} placeholder="Optional" />
    </FormSheet>
  )
  const incomeForm = () => (
    <FormSheet title="New income" onSubmit={addIncome} submitLabel="Add income" onCancel={closeForms} accent={C.green}>
      <label style={lbl}>Source</label>
      <input style={inp} value={form.incName} onChange={e => upd("incName", e.target.value)} placeholder="Salary, freelance…" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><label style={lbl}>Amount (USD)</label><input style={inp} type="number" value={form.incAmt} onChange={e => upd("incAmt", e.target.value)} placeholder="0.00" min="0" /></div>
        <div><label style={lbl}>Date</label><input style={inp} type="date" value={form.incDate} onChange={e => upd("incDate", e.target.value)} /></div>
      </div>
      <label style={lbl}>Note (optional)</label>
      <input style={inp} value={form.incNote} onChange={e => upd("incNote", e.target.value)} placeholder="Optional" />
    </FormSheet>
  )
  const ccForm = () => (
    <FormSheet title="Add card charge" onSubmit={addCC} submitLabel="Add charge" onCancel={closeForms} accent={C.amber}>
      <label style={lbl}>Description</label>
      <input style={inp} value={form.ccName} onChange={e => upd("ccName", e.target.value)} placeholder="UberEats, restaurant…" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><label style={lbl}>Amount (MXN)</label><input style={inp} type="number" value={form.ccAmt} onChange={e => upd("ccAmt", e.target.value)} placeholder="0.00" min="0" /></div>
        <div><label style={lbl}>Date</label><input style={inp} type="date" value={form.ccDate} onChange={e => upd("ccDate", e.target.value)} /></div>
      </div>
      <label style={lbl}>Card</label>
      <ToggleRow value={form.ccCard} onChange={v => upd("ccCard", v as (typeof CC_CARDS)[number])} options={CC_CARDS.map(c => ({ value: c, label: c }))} />
      <label style={lbl}>Installments</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <input style={{ ...inp, marginBottom: 0, width: 72 }} type="number" min="1" max="48" value={form.ccInstallments} onChange={e => upd("ccInstallments", parseInt(e.target.value) || 1)} />
        <span style={{ fontSize: 13, color: C.muted }}>
          {form.ccInstallments > 1 ? `months · ${fmt(parseFloat(form.ccAmt || "0") / form.ccInstallments)}/mo` : "month"}
        </span>
      </div>
      <label style={lbl}>Category</label>
      <select style={inp} value={form.ccCat} onChange={e => upd("ccCat", e.target.value)}>
        {CATS.map(c => <option key={c}>{c}</option>)}
      </select>
    </FormSheet>
  )
  const invForm = () => (
    <FormSheet title="Log a buy" onSubmit={addInvestment} submitLabel="Log buy" onCancel={closeForms} accent={C.blue}>
      <label style={lbl}>Asset / fund name</label>
      <input style={inp} value={form.invName} onChange={e => upd("invName", e.target.value)} placeholder="Nubank, S&P 500…" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><label style={lbl}>Amount (MXN)</label><input style={inp} type="number" value={form.invAmt} onChange={e => upd("invAmt", e.target.value)} placeholder="0.00" min="0" /></div>
        <div><label style={lbl}>Date</label><input style={inp} type="date" value={form.invDate} onChange={e => upd("invDate", e.target.value)} /></div>
      </div>
      <label style={lbl}>Type</label>
      <ToggleRow value={form.invType} onChange={v => upd("invType", v)} options={[{ value: "fund", label: "Fund" }, { value: "stock", label: "Stock" }]} />
      <label style={lbl}>Account</label>
      <ToggleRow value={form.invGf ? "gf" : "me"} onChange={v => upd("invGf", v === "gf")} options={[{ value: "me", label: "Mine" }, { value: "gf", label: "GF" }]} />
      <label style={lbl}>Note (optional)</label>
      <input style={inp} value={form.invNote} onChange={e => upd("invNote", e.target.value)} placeholder="Optional" />
    </FormSheet>
  )

  const PAD: React.CSSProperties = { padding: "16px 14px 8px" }

  return (
    <div style={{
      background: C.bg, color: C.text, minHeight: "100vh",
      display: "flex", flexDirection: "column",
    }}>
      {/* ── Top bar: greeting + month + quick actions ── */}
      <TopBar
        name="Diego"
        moName={moName} vy={vy}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        atCurrent={isCurrentMonth()}
        onQuickLog={() => setQuickOpen(true)}
        onRefresh={doRefresh}
        refreshing={refreshing}
      />

      <div key={tab} className="ft-fade-up" style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 90 }}>

        {/* ══ OVERVIEW ══ */}
        {tab === "Overview" && (
          <HomeScreen
            moName={moName}
            prevMoName={prevDate.toLocaleString("en-US", { month: "long" })}
            prevIncMXN={prevIncMXN}
            onNavigate={handleHomeNav}
            fxSource={fxSource}
            currentCash={currentCash}
            totalIncMXN={totalIncMXN} totalIncUSD={totalIncUSD}
            totalExpMXN={totalExpMXN}
            monthInvMXN={monthInvMXN}
            monthCCTotal={monthCCTotal}
            monthExpCount={monthExp.length}
            monthCCCount={monthCC.length}
            monthInvCount={monthInv.length}
            ccPoolTotal={ccPoolTotal}
            ccWarning={ccWarning}
            cashDelta={cashDelta}
            fxRate={FX}
            catTotals={catTotals} catGrand={catGrand} catPrev={catPrev}
            netWorthLine={netWorthLine}
            liveInvestmentValue={investmentValue}
            investmentCost={investmentCost}
            catSeries={catSeries}
            last6Labels={last6.map(p => p.label)}
          />
        )}


        {/* ══ CARDS ══ */}
        {tab === "Cards" && (
          <div style={PAD}>

            {/* ── Total unpaid pool · refined hero ─────────────────────── */}
            <div style={{
              position: "relative", overflow: "hidden",
              background: C.elevated, border: `1px solid ${C.border}`,
              borderRadius: 22, padding: "22px 22px 20px", marginBottom: 16,
            }}>
              <div style={{
                position: "absolute", top: -80, right: -50, width: 220, height: 220,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${C.amber}33, transparent 70%)`,
                pointerEvents: "none",
              }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, marginBottom: 8 }}>
                  Total unpaid pool
                </div>
                <div style={{ fontSize: 40, fontWeight: 800, color: C.amber, letterSpacing: "-1.5px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {fmt(ccPoolTotal)}<span style={{ fontSize: 14, fontWeight: 500, color: C.muted, marginLeft: 8 }}>MXN</span>
                </div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
                  across {CC_CARDS.filter(c => (ccPoolByCard[c] ?? 0) > 0).length} card{CC_CARDS.filter(c => (ccPoolByCard[c] ?? 0) > 0).length !== 1 ? "s" : ""}
                </div>
              </div>
            </div>

            {/* ── Stack of credit-card-styled tiles, one per card ──────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              {CC_CARDS.map(card => {
                const pool = ccPoolByCard[card] ?? 0
                const cfg = cardConfig[card]
                const cardCharges = ccExpanded.filter(c => c.card === card)
                const settledForCard = state.settled[card] ?? 0
                let currentCycleTotal = 0
                let statementBalance = pool
                if (cfg) {
                  const cycle = computeCycle(cfg)
                  const parts = partitionByCycle(cardCharges, cycle)
                  currentCycleTotal = parts.current.reduce((s, c) => s + c.amount, 0)
                  const billed = parts.statement.reduce((s, c) => s + c.amount, 0) + parts.carryover.reduce((s, c) => s + c.amount, 0)
                  statementBalance = Math.max(0, billed - settledForCard)
                }
                // Match this card to its current-period statement (if any)
                const periodNow = cfg
                  ? `${computeCycle(cfg).lastCutoff.getFullYear()}-${String(computeCycle(cfg).lastCutoff.getMonth() + 1).padStart(2, "0")}`
                  : undefined
                const stmt = state.statements?.find(s => s.card === card && s.period === periodNow)
                return (
                  <CardTile
                    key={card}
                    card={card}
                    cfg={cfg}
                    pool={pool}
                    currentCycleTotal={currentCycleTotal}
                    statementBalance={statementBalance}
                    statement={stmt}
                    onSettle={() => settleCard(card)}
                    onPaymentRecorded={load}
                  />
                )
              })}
            </div>

            {/* MSI / financing forecast — next 12 months locked-in */}
            {obligations.length > 0 && (() => {
              const HORIZON = 12
              // Group by card, compute monthly buckets for the next HORIZON months
              const byCard: Record<string, number[]> = {}
              const totalByMonth = Array(HORIZON).fill(0)
              for (const o of obligations) {
                if (!byCard[o.card]) byCard[o.card] = Array(HORIZON).fill(0)
                for (let i = 0; i < Math.min(o.monthsRemaining, HORIZON); i++) {
                  byCard[o.card][i] += o.monthlyAmount
                  totalByMonth[i] += o.monthlyAmount
                }
              }
              const totalLocked = totalByMonth.reduce((s, v) => s + v, 0)
              const nextMonthByCard: Record<string, number> = {}
              for (const [card, arr] of Object.entries(byCard)) nextMonthByCard[card] = arr[0]
              const maxBar = Math.max(...totalByMonth, 1)
              const months = Array.from({ length: HORIZON }, (_, i) => {
                const d = new Date()
                d.setMonth(d.getMonth() + i)
                return d.toLocaleString("en-US", { month: "short" })
              })
              return (
                <div style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 22, padding: "18px 18px 16px", marginBottom: 16,
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute", top: -50, right: -40, width: 160, height: 160, borderRadius: "50%",
                    background: `radial-gradient(circle, ${C.amber}26, transparent 70%)`, pointerEvents: "none",
                  }} />
                  <div style={{ position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>Locked-in MSI</div>
                        <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>next {HORIZON} months</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: C.amber, letterSpacing: "-0.6px", fontVariantNumeric: "tabular-nums" }}>
                          {fmt(totalLocked)}<span style={{ fontSize: 11, color: C.muted, fontWeight: 500, marginLeft: 4 }}>MXN</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: C.dim, marginTop: 3 }}>
                          next mo <span style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{fmt(totalByMonth[0])}</span>
                        </div>
                      </div>
                    </div>
                    <svg viewBox="0 0 360 70" style={{ width: "100%", height: 70, display: "block", marginTop: 4 }}>
                      <defs>
                        <linearGradient id="msiGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.amber} stopOpacity="1" />
                          <stop offset="100%" stopColor={C.amber} stopOpacity="0.5" />
                        </linearGradient>
                      </defs>
                      {totalByMonth.map((v, i) => {
                        const bw = 24, gap = 6
                        const x = i * (bw + gap)
                        const h = (v / maxBar) * 60
                        return (
                          <g key={i}>
                            <rect x={x} y={64 - h} width={bw} height={h} rx={4} fill="url(#msiGrad)" opacity={i === 0 ? 1 : 0.75} />
                            <text x={x + bw / 2} y={70} textAnchor="middle" fontSize={8.5} fill={i === 0 ? C.amber : C.dim} fontWeight={i === 0 ? 700 : 400}>{months[i]}</text>
                            <title>{months[i]}: {fmt(v)}</title>
                          </g>
                        )
                      })}
                    </svg>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                      {Object.entries(nextMonthByCard).map(([card, amt]) => (
                        <div key={card} style={{
                          padding: "6px 11px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 100,
                          fontSize: 11, color: C.text, display: "inline-flex", alignItems: "center", gap: 6,
                        }}>
                          <span style={{ fontSize: 9.5, color: C.amber, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>{card}</span>
                          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{fmt(amt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            <StatementsPanel statements={state.statements ?? []} ccExpanded={ccExpanded} cardConfig={cardConfig} reload={load} />

            {showForm && ccForm()}

            {/* Category breakdown */}
            {monthCC.length > 0 && (() => {
              const ct: Record<string, number> = {}
              monthCC.forEach(e => { ct[e.cat] = (ct[e.cat] ?? 0) + e.amount })
              const tot = Object.values(ct).reduce((s, v) => s + v, 0)
              return (
                <Card style={{ padding: 16, marginBottom: 14 }}>
                  <Label>This month by category</Label>
                  {Object.entries(ct).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                    const pct = Math.round(amt / tot * 100)
                    return (
                      <div key={cat} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: CAT_COLORS[cat] ?? C.muted }} />{cat}
                          </span>
                          <span style={{ fontSize: 12, color: C.muted }}>
                            {fmt(amt)} <span style={{ fontSize: 10, color: C.dim }}>({pct}%)</span>
                          </span>
                        </div>
                        <div style={{ background: C.border, borderRadius: 20, height: 4, overflow: "hidden" }}>
                          <div style={{ width: pct + "%", height: "100%", borderRadius: 20, background: CAT_COLORS[cat] ?? C.muted, transition: "width .4s" }} />
                        </div>
                      </div>
                    )
                  })}
                </Card>
              )
            })()}

            <SearchBar value={search.cc} onChange={v => setSearch(s => ({ ...s, cc: v }))} placeholder="Search charges…" />
            {(() => {
              const filtered = monthCC.filter(e => e.name.toLowerCase().includes(search.cc.toLowerCase()))
              const ft = filtered.reduce((s, e) => s + e.amount, 0)
              return filtered.length === 0 ? (
                <Empty icon="cards" label="No charges this month" sub={search.cc ? "Try a different search" : undefined} />
              ) : (
                <>
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 8 }}>
                    {[...filtered].sort((a, b) => b.date.localeCompare(a.date)).map((e, i, arr) => {
                      const sourceCc = state.cc.find(x => x.id === e.installmentOf)
                      return (
                        <EntryRow
                          key={e.id}
                          isLast={i === arr.length - 1} index={i}
                          icon={<div style={{ width: 11, height: 11, borderRadius: 3, background: CAT_COLORS[e.cat] ?? C.amber }} />}
                          iconBg={(CAT_COLORS[e.cat] ?? C.amber) + "22"}
                          name={
                            <>
                              {e.name}
                              {e.installmentOf && (
                                <span style={{ fontSize: 10, color: C.muted, marginLeft: 6 }}>
                                  ({e.installmentN}/{sourceCc?.installments ?? "?"})
                                </span>
                              )}
                            </>
                          }
                          sub={`${fmtDate(e.date)} · ${e.card} · ${e.cat}`}
                          amount={fmt(e.amount)}
                          amtColor={C.amber}
                          onDel={!e.installmentOf ? () => delCC(e.id) : null}
                          onEdit={!e.installmentOf ? () => {
                            const src = state.cc.find(x => x.id === e.id)
                            if (src) setEditing({ kind: "cc", row: src })
                          } : null}
                        />
                      )
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px", fontSize: 12, color: C.muted }}>
                    <span>{filtered.length} charge{filtered.length !== 1 ? "s" : ""}</span>
                    <span style={{ fontWeight: 700, color: C.amber }}>{fmt(ft)} MXN total</span>
                  </div>
                </>
              )
            })()}
            <FAB label={showForm ? "Close" : "Add charge"} icon={showForm ? "close" : "plus"} onClick={() => setShowForm(v => !v)} color={C.amber} ghost={showForm} />
          </div>
        )}

        {/* ══ EXPENSES ══ */}
        {tab === "Expenses" && (
          <div style={PAD}>
            <ToggleRow
              value="expenses"
              onChange={v => setTab(v === "income" ? "Income" : "Expenses")}
              options={[{ value: "expenses", label: "Expenses" }, { value: "income", label: "Income" }]}
            />
            {showForm && expenseForm()}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "13px 16px", marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{moName} total</span>
              <span style={{ fontSize: 19, fontWeight: 700, color: C.red, letterSpacing: "-0.4px" }}>{fmt(totalExpMXN)} MXN</span>
            </div>
            <SearchBar value={search.exp} onChange={v => setSearch(s => ({ ...s, exp: v }))} placeholder="Search expenses…" />
            {catFilter && (
              <button onClick={() => setCatFilter(null)} style={{
                display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10,
                padding: "6px 12px", fontSize: 11.5, fontFamily: "inherit", fontWeight: 700,
                border: "none", borderRadius: 100, cursor: "pointer",
                background: (CAT_COLORS[catFilter] ?? C.muted) + "22",
                color: CAT_COLORS[catFilter] ?? C.muted,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: CAT_COLORS[catFilter] ?? C.muted }} />
                {catFilter}
                <Icon name="close" size={11} color={CAT_COLORS[catFilter] ?? C.muted} />
              </button>
            )}
            {(() => {
              const q = search.exp.toLowerCase()
              const filtered = monthExp.filter(e =>
                (!catFilter || e.cat === catFilter) && (
                  e.name.toLowerCase().includes(q) ||
                  e.cat.toLowerCase().includes(q) ||
                  (e.note ?? "").toLowerCase().includes(q)
                )
              )
              const ft = filtered.reduce((s, e) => s + e.amount, 0)
              return filtered.length === 0 ? (
                <Empty icon="expenses" label="No expenses this month" sub={search.exp ? "Try a different search" : "Tap + to add one"} />
              ) : (
                <>
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 8 }}>
                    {[...filtered].sort((a, b) => b.date.localeCompare(a.date)).map((e, i, arr) => (
                      <EntryRow
                        key={e.id}
                        isLast={i === arr.length - 1} index={i}
                        icon={<div style={{ width: 11, height: 11, borderRadius: "50%", background: CAT_COLORS[e.cat] ?? C.muted }} />}
                        iconBg={(CAT_COLORS[e.cat] ?? C.muted) + "22"}
                        name={e.name}
                        sub={`${fmtDate(e.date)} · ${e.cat}${e.note ? ` · ${e.note}` : ""}`}
                        amount={fmt(e.amount)}
                        amtColor={CAT_COLORS[e.cat] ?? C.red}
                        onDel={() => delEntry("expense", e.id)}
                        onEdit={() => setEditing({ kind: "expense", row: e })}
                      />
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px", fontSize: 12, color: C.muted }}>
                    <span>{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
                    <span style={{ fontWeight: 700, color: C.red }}>{fmt(ft)} MXN total</span>
                  </div>
                </>
              )
            })()}
            <FAB label={showForm ? "Close" : "Add expense"} icon={showForm ? "close" : "plus"} onClick={() => setShowForm(v => !v)} color={C.red} ghost={showForm} />
          </div>
        )}

        {/* ══ INCOME ══ */}
        {tab === "Income" && (
          <div style={PAD}>
            <ToggleRow
              value="income"
              onChange={v => setTab(v === "income" ? "Income" : "Expenses")}
              options={[{ value: "expenses", label: "Expenses" }, { value: "income", label: "Income" }]}
            />
            {showForm && incomeForm()}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "13px 16px", marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{moName} total</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 19, fontWeight: 700, color: C.green, letterSpacing: "-0.4px" }}>{fmt(totalIncUSD)} USD</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{fmt(totalIncMXN)} MXN equiv.</div>
              </div>
            </div>
            <SearchBar value={search.inc} onChange={v => setSearch(s => ({ ...s, inc: v }))} placeholder="Search income…" />
            {(() => {
              const filtered = monthInc.filter(e => e.name.toLowerCase().includes(search.inc.toLowerCase()))
              return filtered.length === 0 ? (
                <Empty icon="income" label="No income this month" sub={search.inc ? "Try a different search" : "Tap + to add one"} />
              ) : (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
                  {[...filtered].sort((a, b) => b.date.localeCompare(a.date)).map((e, i, arr) => (
                    <EntryRow
                      key={e.id}
                      isLast={i === arr.length - 1} index={i}
                      icon={<Icon name="income" size={18} color={C.green} />}
                      iconBg={C.green + "22"}
                      name={e.name}
                      sub={`${fmtDate(e.date)}${e.note ? ` · ${e.note}` : ""}`}
                      amount={fmt(e.amount) + " USD"}
                      amtColor={C.green}
                      onDel={() => delEntry("income", e.id)}
                      onEdit={() => setEditing({ kind: "income", row: e })}
                      rightExtra={<div style={{ fontSize: 11, color: C.muted, textAlign: "right", marginRight: 4 }}>{fmt(e.amount * FX)} MXN</div>}
                    />
                  ))}
                </div>
              )
            })()}
            <FAB label={showForm ? "Close" : "Add income"} icon={showForm ? "close" : "plus"} onClick={() => setShowForm(v => !v)} color={C.green} ghost={showForm} />
          </div>
        )}

        {/* ══ INVESTMENTS ══ */}
        {tab === "Investments" && (
          <div style={PAD}>
            {/* ── Invest hero · refined ─────────────────────────────── */}
            <div style={{
              position: "relative", overflow: "hidden",
              background: C.elevated, border: `1px solid ${C.border}`,
              borderRadius: 22, padding: "22px 22px 18px", marginBottom: 14,
            }}>
              <div style={{
                position: "absolute", top: -80, right: -50, width: 240, height: 240, borderRadius: "50%",
                background: `radial-gradient(circle, ${C.blue}33, transparent 70%)`, pointerEvents: "none",
              }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, marginBottom: 8 }}>
                  Total invested
                </div>
                <div style={{ fontSize: 40, fontWeight: 800, color: C.blue, letterSpacing: "-1.5px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {fmt(totalInvAllTime)}<span style={{ fontSize: 14, fontWeight: 500, color: C.muted, marginLeft: 8 }}>MXN</span>
                </div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>all-time cost basis</div>

                {/* Bucket grid — tap a tile to filter the views below to that bucket */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18 }}>
                  {BUCKETS.map(b => {
                    const active = bucketFilter === b.id
                    return (
                      <button
                        key={b.id}
                        onClick={() => {
                          buzz()
                          if (active) { setBucketFilter(null); return }
                          setBucketFilter(b.id)
                          if (activeInvTab === "maps") setActiveInvTab("portfolio")
                        }}
                        style={{
                          background: active ? b.dim : C.card,
                          border: `1px solid ${active ? b.color : b.color + "33"}`,
                          borderRadius: 14,
                          padding: "12px 14px", position: "relative", overflow: "hidden",
                          cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                          WebkitTapHighlightColor: "transparent",
                          transition: "background 200ms cubic-bezier(0.4,0,0.2,1), border 200ms cubic-bezier(0.4,0,0.2,1)",
                        }}
                      >
                        <div style={{
                          position: "absolute", top: -20, right: -20, width: 60, height: 60, borderRadius: "50%",
                          background: b.color, opacity: active ? 0.22 : 0.10, pointerEvents: "none",
                          transition: "opacity 200ms",
                        }} />
                        <div style={{ position: "relative" }}>
                          <div style={{ fontSize: 10, color: b.color, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                            {b.label}
                            {active && <Icon name="check" size={10} color={b.color} />}
                          </div>
                          <div style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.4px", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
                            {fmt(bucketTotals[b.id])}
                          </div>
                          <div style={{ fontSize: 9.5, color: C.dim, marginTop: 2 }}>MXN</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Live fund prices */}
            {Object.keys(funds).length > 0 && (
              <div style={{
                position: "relative", overflow: "hidden",
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 22, padding: "18px 18px 16px", marginBottom: 16,
              }}>
                <div style={{
                  position: "absolute", top: -50, right: -40, width: 160, height: 160, borderRadius: "50%",
                  background: `radial-gradient(circle, ${C.purple}22, transparent 70%)`, pointerEvents: "none",
                }} />
                <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <Label style={{ marginBottom: 0 }}>Live fund NAV</Label>
                  <button onClick={refreshPrices} disabled={priceBusy} style={{
                    padding: "6px 12px", fontSize: 10.5, fontWeight: 700, border: "none", borderRadius: 100,
                    cursor: "pointer",
                    background: priceBusy ? C.cardHi : C.purple,
                    color: priceBusy ? C.muted : "#0B0D11",
                    fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5,
                    boxShadow: priceBusy ? "none" : `0 4px 14px ${C.purple}44`,
                  }}>
                    <Icon name="refresh" size={12} color={priceBusy ? C.muted : "#0B0D11"} />
                    {priceBusy ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  {Object.entries(funds).map(([name, fund], i, arr) => {
                    const p = state.prices?.[name]
                    return (
                      <div key={name} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 0",
                        borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
                      }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{name}</div>
                          {name !== fund && <div style={{ fontSize: 10.5, color: C.dim, marginTop: 2 }}>→ {fund}</div>}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {p ? (
                            <>
                              <div style={{ fontSize: 16, fontWeight: 800, color: C.purple, letterSpacing: "-0.3px", fontVariantNumeric: "tabular-nums" }}>
                                {p.price.toFixed(4)} <span style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>{p.currency}</span>
                              </div>
                              <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>as of {fmtDate(p.updatedAt.split("T")[0])}</div>
                            </>
                          ) : (
                            <div style={{ fontSize: 11, color: C.muted }}>not fetched yet</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <ToggleRow
              value={activeInvTab}
              onChange={setActiveInvTab}
              options={[{ value: "portfolio", label: "Portfolio" }, { value: "pl", label: "P&L" }, { value: "history", label: "History" }, { value: "maps", label: "Maps" }]}
            />

            {/* Active bucket filter chip */}
            {bucketFilter && (() => {
              const b = BUCKETS.find(x => x.id === bucketFilter)
              if (!b) return null
              return (
                <button onClick={() => setBucketFilter(null)} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10,
                  padding: "6px 12px", fontSize: 11.5, fontFamily: "inherit", fontWeight: 700,
                  border: "none", borderRadius: 100, cursor: "pointer",
                  background: b.color + "22", color: b.color,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: b.color }} />
                  {b.label}
                  <Icon name="close" size={11} color={b.color} />
                </button>
              )
            })()}

            {activeInvTab === "portfolio" && (
              <>
                <Card style={{ padding: 16, marginBottom: 14 }}>
                  <Label>Cumulative invested</Label>
                  <LineChart points={invCumLine} color={C.blue} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    {last6.map(p => <span key={p.label} style={{ fontSize: 9, color: C.dim }}>{p.label}</span>)}
                  </div>
                </Card>
                {BUCKETS.filter(b => !bucketFilter || b.id === bucketFilter).map(b => {
                  const assets = assetBreakdown(b.gf, b.type)
                  const total = bucketTotals[b.id]
                  if (!assets.length) return null
                  return (
                    <Card key={b.id} style={{ padding: 16, marginBottom: 12, borderColor: b.color + "33" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: b.color }}>{b.label}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{fmt(total)} MXN</div>
                      </div>
                      {assets.map(([name, amt], i) => {
                        const pct = Math.round(amt / total * 100)
                        return (
                          <div key={name} style={{ marginBottom: i < assets.length - 1 ? 12 : 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                              <span style={{ fontSize: 13, color: C.text }}>{name}</span>
                              <span style={{ fontSize: 12, color: C.muted }}>
                                {fmt(amt)} <span style={{ fontSize: 10, color: C.dim }}>({pct}%)</span>
                              </span>
                            </div>
                            <div style={{ background: C.border, borderRadius: 20, height: 5, overflow: "hidden" }}>
                              <div style={{ width: pct + "%", height: "100%", borderRadius: 20, background: b.color, opacity: 0.85, transition: "width .4s" }} />
                            </div>
                          </div>
                        )
                      })}
                    </Card>
                  )
                })}
              </>
            )}

            {activeInvTab === "pl" && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
                  <div style={{ fontSize: 11.5, color: C.muted }}>Stocks + funds · set ticker for auto-refresh</div>
                  <button
                    onClick={refreshPrices}
                    disabled={priceBusy || Object.keys(tickers).length === 0}
                    style={{
                      padding: "6px 12px", fontSize: 11, fontWeight: 700,
                      border: "none", borderRadius: 100, cursor: "pointer",
                      background: priceBusy ? C.cardHi : C.blue,
                      color: priceBusy ? C.muted : "#0B0D11",
                      fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
                      boxShadow: Object.keys(tickers).length === 0 || priceBusy ? "none" : `0 4px 14px ${C.blue}44`,
                      opacity: Object.keys(tickers).length === 0 ? 0.5 : 1,
                    }}
                  >
                    <Icon name="refresh" size={12} color={priceBusy ? C.muted : "#0B0D11"} />
                    {priceBusy ? "Refreshing…" : "Refresh prices"}
                  </button>
                </div>
                {Object.entries(invByName).filter(([, v]) => matchesBucket(v.gf, "stock")).length === 0 ? (
                  <Empty icon="invest" label="No stock positions yet" sub="Log a buy to start tracking" />
                ) : (
                  Object.entries(invByName).filter(([, v]) => matchesBucket(v.gf, "stock")).map(([key, { name, gf, cost, shares }]) => {
                    const p = state.prices?.[name]
                    const cur = p?.price ?? 0
                    const valMXN = shares > 0 ? shares * cur * FX : 0
                    const plMXN = shares > 0 && cur > 0 ? valMXN - cost : 0
                    const plPct = cost > 0 && shares > 0 && cur > 0 ? (plMXN / cost * 100) : 0
                    return (
                      <Card key={key} style={{ padding: "14px 16px", marginBottom: 10 }}>
                        <div
                          onClick={() => setAssetDetail({ name, gf, type: "stock" })}
                          style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: cur > 0 ? 12 : 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                        >
                          <div style={{
                            width: 38, height: 38, borderRadius: 11, background: C.blueDim,
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            fontSize: 13, fontWeight: 700, color: C.blue,
                          }}>{name.slice(0, 2).toUpperCase()}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                              {name}<Tag color={gf ? C.purple : C.blue}>{gf ? "GF" : "Mine"}</Tag>
                              <Icon name="chevR" size={12} color={C.dim} />
                            </div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                              {shares > 0 ? `${shares.toFixed(4)} shares · ` : ""}Cost {fmt(cost)} MXN
                            </div>
                          </div>
                          {shares > 0 && cur > 0 && (
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: plMXN >= 0 ? C.green : C.red }}>
                                {plMXN >= 0 ? "+" : ""}{fmt(plMXN)}
                              </div>
                              <div style={{ fontSize: 11, color: plMXN >= 0 ? C.green : C.red, marginTop: 2 }}>
                                {plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%
                              </div>
                              {(() => {
                                const b = bench[key]
                                if (!b) return null
                                const out = plPct - b.pct
                                return (
                                  <div style={{ fontSize: 9.5, color: C.dim, marginTop: 3 }}>
                                    vs {b.symbol}: {b.pct >= 0 ? "+" : ""}{b.pct.toFixed(1)}%
                                    <span style={{ color: out >= 0 ? C.green : C.red, marginLeft: 4 }}>
                                      ({out >= 0 ? "+" : ""}{out.toFixed(1)})
                                    </span>
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                        {cur > 0 && (
                          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                            <div style={{ flex: 1, background: C.bg, borderRadius: 12, padding: "10px 12px" }}>
                              <div style={{ fontSize: 9.5, color: C.muted, marginBottom: 3, letterSpacing: "0.04em" }}>CURRENT PRICE</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: C.blue }}>${cur.toFixed(2)}</div>
                              <div style={{ fontSize: 10, color: C.dim }}>{fmt(cur * FX)} MXN</div>
                            </div>
                            <div style={{ flex: 1, background: C.bg, borderRadius: 12, padding: "10px 12px" }}>
                              <div style={{ fontSize: 9.5, color: C.muted, marginBottom: 3, letterSpacing: "0.04em" }}>POSITION VALUE</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmt(valMXN)} MXN</div>
                              {p?.updatedAt && <div style={{ fontSize: 10, color: C.dim }}>as of {fmtDate(p.updatedAt.split("T")[0])}</div>}
                            </div>
                          </div>
                        )}
                        {/* Row 1: ticker mapping + Pull (no overflow risk) */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <input
                            type="text" placeholder="Ticker (e.g. NU, AAPL)"
                            defaultValue={tickers[name] ?? ""}
                            autoCapitalize="characters"
                            spellCheck={false}
                            style={{
                              flex: 1, minWidth: 0, padding: "10px 12px", fontSize: 13, fontFamily: "inherit",
                              border: `1px solid ${C.border}`, borderRadius: 10,
                              background: C.bg, color: C.text, outline: "none", boxSizing: "border-box",
                              textTransform: "uppercase",
                            }}
                            onBlur={e => {
                              const v = e.target.value.trim().toUpperCase()
                              if (v !== (tickers[name] ?? "")) setTicker(name, v)
                            }}
                          />
                          <button
                            onClick={async () => {
                              const t = tickers[name]
                              if (!t) return
                              setPriceBusy(true)
                              try { await api("/api/prices", "POST"); await load() }
                              finally { setPriceBusy(false) }
                            }}
                            disabled={!tickers[name] || priceBusy}
                            style={{
                              padding: "10px 14px", fontSize: 11.5, fontWeight: 700,
                              border: "none", borderRadius: 10, cursor: "pointer",
                              background: tickers[name] ? C.blueDim : C.surface,
                              color: tickers[name] ? C.blue : C.dim,
                              fontFamily: "inherit", flexShrink: 0,
                              opacity: priceBusy ? 0.5 : 1,
                            }}
                          >Pull</button>
                        </div>
                        {/* Row 2: manual override (its own line so it doesn't get clipped) */}
                        <details style={{ fontSize: 11, color: C.muted }}>
                          <summary style={{ cursor: "pointer", userSelect: "none", padding: "4px 0" }}>Set price manually</summary>
                          <input
                            type="number" placeholder="USD" min="0" step="0.01"
                            style={{
                              width: "100%", marginTop: 6, padding: "10px 12px", fontSize: 13,
                              fontFamily: "inherit", border: `1px solid ${C.border}`, borderRadius: 10,
                              background: C.bg, color: C.text, outline: "none", boxSizing: "border-box",
                            }}
                            onBlur={e => {
                              const v = parseFloat(e.target.value)
                              if (!isNaN(v) && v > 0) { updatePrice(name, v); e.currentTarget.value = "" }
                            }}
                          />
                        </details>
                      </Card>
                    )
                  })
                )}

                {/* ── Funds ── */}
                {Object.entries(fundByName).some(([, v]) => matchesBucket(v.gf, "fund")) && (
                  <>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, margin: "18px 0 10px" }}>Funds (MXN)</div>
                    {Object.entries(fundByName).filter(([, v]) => matchesBucket(v.gf, "fund")).map(([key, { name, gf, cost, shares, uncoveredCost }]) => {
                      const p = state.prices?.[name]
                      const cur = p?.price ?? 0   // fund NAV in MXN
                      const valMXN = shares > 0 ? shares * cur : 0
                      // P&L only counts cost that has a known purchase_nav
                      const coveredCost = cost - uncoveredCost
                      const plMXN = shares > 0 && cur > 0 ? valMXN - coveredCost : 0
                      const plPct = coveredCost > 0 && shares > 0 && cur > 0 ? (plMXN / coveredCost * 100) : 0
                      return (
                        <Card key={key} style={{ padding: "14px 16px", marginBottom: 10 }}>
                          <div
                            onClick={() => setAssetDetail({ name, gf, type: "fund" })}
                            style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: cur > 0 ? 12 : 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                          >
                            <div style={{
                              width: 38, height: 38, borderRadius: 11, background: C.purpleDim,
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                              fontSize: 13, fontWeight: 700, color: C.purple,
                            }}>{name.slice(0, 2).toUpperCase()}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                                {name}<Tag color={gf ? C.pink : C.purple}>{gf ? "GF" : "Mine"}</Tag>
                                <Icon name="chevR" size={12} color={C.dim} />
                              </div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                                {shares > 0 ? `${shares.toFixed(4)} shares · ` : ""}Cost {fmt(cost)} MXN
                                {uncoveredCost > 0 && <span style={{ color: C.dim }}> · {fmt(uncoveredCost)} no NAV</span>}
                              </div>
                            </div>
                            {shares > 0 && cur > 0 && (
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: plMXN >= 0 ? C.green : C.red }}>
                                  {plMXN >= 0 ? "+" : ""}{fmt(plMXN)}
                                </div>
                                <div style={{ fontSize: 11, color: plMXN >= 0 ? C.green : C.red, marginTop: 2 }}>
                                  {plPct >= 0 ? "+" : ""}{plPct.toFixed(2)}%
                                </div>
                                {(() => {
                                  const b = bench[key]
                                  if (!b) return null
                                  const out = plPct - b.pct
                                  return (
                                    <div style={{ fontSize: 9.5, color: C.dim, marginTop: 3 }}>
                                      vs {b.symbol}: {b.pct >= 0 ? "+" : ""}{b.pct.toFixed(2)}%
                                      <span style={{ color: out >= 0 ? C.green : C.red, marginLeft: 4 }}>
                                        ({out >= 0 ? "+" : ""}{out.toFixed(2)})
                                      </span>
                                    </div>
                                  )
                                })()}
                              </div>
                            )}
                          </div>
                          {cur > 0 && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <div style={{ flex: 1, background: C.bg, borderRadius: 12, padding: "10px 12px" }}>
                                <div style={{ fontSize: 9.5, color: C.muted, marginBottom: 3, letterSpacing: "0.04em" }}>CURRENT NAV</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: C.purple }}>{cur.toFixed(4)} MXN</div>
                                {p?.updatedAt && <div style={{ fontSize: 10, color: C.dim }}>as of {fmtDate(p.updatedAt.split("T")[0])}</div>}
                              </div>
                              <div style={{ flex: 1, background: C.bg, borderRadius: 12, padding: "10px 12px" }}>
                                <div style={{ fontSize: 9.5, color: C.muted, marginBottom: 3, letterSpacing: "0.04em" }}>POSITION VALUE</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmt(valMXN)} MXN</div>
                              </div>
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </>
                )}
              </div>
            )}

            {activeInvTab === "history" && (
              <>
                <SearchBar value={search.inv} onChange={v => setSearch(s => ({ ...s, inv: v }))} placeholder="Search investments…" />
                {(() => {
                  const filtered = state.investments.filter(e => matchesBucket(e.gf, e.inv_type) && e.name.toLowerCase().includes(search.inv.toLowerCase()))
                  return filtered.length === 0 ? (
                    <Empty icon="invest" label="No investments logged yet" sub={search.inv ? "Try a different search" : "Log a buy to start"} />
                  ) : (
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
                      {[...filtered].sort((a, b) => b.date.localeCompare(a.date)).map((e, i, arr) => {
                        const bucket = getBucket(e)
                        return (
                          <EntryRow
                            key={e.id}
                            isLast={i === arr.length - 1} index={i}
                            icon={<div style={{ width: 11, height: 11, borderRadius: e.inv_type === "stock" ? 3 : "50%", background: bucket.color }} />}
                            iconBg={bucket.dim}
                            name={
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                {e.name}<BucketTag bucket={bucket} />
                                {e.historical && <Tag color={C.dim}>historical</Tag>}
                              </span>
                            }
                            sub={`${fmtDate(e.date)}${e.note ? ` · ${e.note}` : ""}`}
                            amount={fmt(e.amount)}
                            amtColor={bucket.color}
                            onDel={() => delInv(e.id)}
                          />
                        )
                      })}
                    </div>
                  )
                })()}
              </>
            )}

            {activeInvTab === "maps" && (
              <MapsEditor
                tickers={tickers} setTickers={setTickers}
                funds={funds} setFunds={setFunds}
                splits={splits} setSplits={setSplits}
                cardConfig={cardConfig} setCardConfig={setCardConfig}
                recurring={recurring} setRecurring={setRecurring}
                obligations={obligations} setObligations={setObligations}
                reload={load}
              />
            )}

            {showForm && <div style={{ marginTop: 14 }}>{invForm()}</div>}
            {activeInvTab !== "maps" && (
              <FAB label={showForm ? "Close" : "Log buy"} icon={showForm ? "close" : "plus"} onClick={() => setShowForm(v => !v)} color={C.blue} ghost={showForm} />
            )}
          </div>
        )}

      </div>

      {/* Bottom navigation */}
      <BottomNav
        active={
          tab === "Overview" ? "Home" :
          (tab === "Expenses" || tab === "Income") ? "Money" :
          tab === "Cards" ? "Cards" : "Invest"
        }
        onChange={(nt: NavTab) => {
          if (nt === "Home") setTab("Overview")
          else if (nt === "Money") setTab(tab === "Income" ? "Income" : "Expenses")
          else if (nt === "Cards") setTab("Cards")
          else if (nt === "Invest") setTab("Investments")
        }}
        onCenterAction={() => setQuickOpen(true)}
      />

      {/* Global quick-log sheet */}
      <QuickLogSheet open={quickOpen} onClose={() => setQuickOpen(false)} onLogged={load} />
      {/* Edit sheet — tap any expense / income / CC row */}
      <EditEntrySheet editing={editing} onClose={() => setEditing(null)} onSaved={load} />
      {/* Asset drill-down — tap a P&L card header */}
      <AssetDetailSheet
        asset={assetDetail}
        buys={assetDetail ? state.investments.filter(i =>
          i.name === assetDetail.name && i.gf === assetDetail.gf && i.inv_type === assetDetail.type
        ) : []}
        currentPrice={assetDetail ? (state.prices?.[assetDetail.name]?.price ?? 0) : 0}
        fxRate={FX}
        onClose={() => setAssetDetail(null)}
      />

      {/* Undo toast */}
      {toast && (
        <div className="ft-slide-up" style={{
          position: "fixed", left: 14, right: 14, bottom: 88, zIndex: 100,
          background: C.cardHi, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: "12px 14px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <span style={{ fontSize: 13, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{toast.msg}</span>
          <button
            onClick={async () => { const t = toast; setToast(null); await t.restore() }}
            style={{
              padding: "7px 13px", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 10,
              cursor: "pointer", background: C.green, color: "#0E0F12", fontFamily: "inherit",
              flexShrink: 0,
            }}
          >Undo</button>
        </div>
      )}
    </div>
  )
}
