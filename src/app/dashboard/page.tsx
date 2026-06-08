"use client"
/**
 * FinTracker dashboard — faithful port of the design handoff
 * (design_handoff_finance_tracker), API-backed via /api/* (Upstash Redis).
 */
import { useCallback, useEffect, useState } from "react"
import type { AppState } from "@/types"
import {
  C, FX_FALLBACK, CAT_COLORS, CATS, CC_CARDS, BUCKETS, getBucket,
  expandCC, fmt, fmtDate, today,
} from "@/lib/utils"
import { Icon } from "@/components/Icon"
import {
  Card, Tag, BucketTag, Label, Empty, SearchBar, ToggleRow,
  EntryRow, FormSheet, FAB, MonthNav, inp, lbl,
} from "@/components/ui"
import { SparkBar, LineChart, Donut } from "@/components/charts"
import { MapsEditor } from "@/components/MapsEditor"
import { QuickLogSheet } from "@/components/QuickLogSheet"

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
  const [priceBusy, setPriceBusy] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
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

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const [entries, ccData, invData, budgets, fx, tickerData, fundData, splitData] = await Promise.all([
        api<{ expenses: AppState["expenses"]; income: AppState["income"] }>("/api/entries"),
        api<{ cc: AppState["cc"]; settled: AppState["settled"] }>("/api/cc"),
        api<{ investments: AppState["investments"]; prices: AppState["prices"] }>("/api/investments"),
        api<{ budgets: AppState["budgets"] }>("/api/budgets"),
        api<{ rate: number }>("/api/fx"),
        api<{ tickers: Record<string, string> }>("/api/prices"),
        api<{ funds: Record<string, string> }>("/api/funds"),
        api<{ splits: typeof splits }>("/api/splits"),
      ])
      setTickers(tickerData.tickers ?? {})
      setFunds(fundData.funds ?? {})
      setSplits(splitData.splits ?? {})
      setState({
        expenses: entries.expenses, income: entries.income,
        cc: ccData.cc, settled: ccData.settled,
        investments: invData.investments, prices: invData.prices,
        budgets: budgets.budgets,
        fxRate: fx.rate ?? FX_FALLBACK,
      })
    } finally {
      setLoading(false)
      setTimeout(() => setRefreshing(false), 600)
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
      <div style={{ padding: "2rem", color: C.muted, background: C.bg, minHeight: "100vh", fontSize: 14 }}>
        Loading…
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
  const assetBreakdown = (gf: boolean, type: "fund" | "stock"): Array<[string, number]> => {
    const map: Record<string, number> = {}
    state.investments.filter(i => i.gf === gf && i.inv_type === type).forEach(i => { map[i.name] = (map[i.name] ?? 0) + i.amount })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }

  /* ── mutations ── */
  const closeForms = () => { setShowForm(false); setQuickAdd(null) }
  const addExpense = async () => {
    if (!form.expName || !form.expAmt) return
    await api("/api/entries", "POST", { type: "expense", name: form.expName, amount: parseFloat(form.expAmt), cat: form.expCat, date: form.expDate || today(), note: form.expNote })
    setForm(f => ({ ...f, expName: "", expAmt: "", expNote: "" }))
    closeForms(); triggerFlash(); load()
  }
  const addIncome = async () => {
    if (!form.incName || !form.incAmt) return
    await api("/api/entries", "POST", { type: "income", name: form.incName, amount: parseFloat(form.incAmt), date: form.incDate || today(), note: form.incNote })
    setForm(f => ({ ...f, incName: "", incAmt: "", incNote: "" }))
    closeForms(); triggerFlash(); load()
  }
  const addCC = async () => {
    if (!form.ccName || !form.ccAmt) return
    await api("/api/cc", "POST", { name: form.ccName, amount: parseFloat(form.ccAmt), date: form.ccDate || today(), cat: form.ccCat, card: form.ccCard, installments: Number(form.ccInstallments) || 1 })
    setForm(f => ({ ...f, ccName: "", ccAmt: "", ccInstallments: 1 }))
    closeForms(); triggerFlash(); load()
  }
  const addInvestment = async () => {
    if (!form.invName || !form.invAmt) return
    await api("/api/investments", "POST", { name: form.invName, amount: parseFloat(form.invAmt), date: form.invDate || today(), note: form.invNote, gf: form.invGf, inv_type: form.invType })
    setForm(f => ({ ...f, invName: "", invAmt: "", invNote: "" }))
    closeForms(); triggerFlash(); load()
  }
  const delEntry = async (type: "expense" | "income", id: string) => {
    const row = (type === "expense" ? state.expenses : state.income).find(e => e.id === id)
    if (!row) return
    await api("/api/entries", "DELETE", { type, id })
    await load()
    setToast({
      msg: `Deleted ${type}: ${row.name}`,
      restore: async () => {
        const { id: _drop, ...rest } = row
        await api("/api/entries", "POST", { type, ...rest })
        await load()
      },
    })
  }
  const delCC = async (id: string) => {
    const row = state.cc.find(e => e.id === id)
    if (!row) return
    await api("/api/cc", "DELETE", { id })
    await load()
    setToast({
      msg: `Deleted charge: ${row.name}`,
      restore: async () => {
        const { id: _drop, ...rest } = row
        await api("/api/cc", "POST", rest)
        await load()
      },
    })
  }
  const delInv = async (id: string) => {
    const row = state.investments.find(e => e.id === id)
    if (!row) return
    await api("/api/investments", "DELETE", { id })
    await load()
    setToast({
      msg: `Deleted: ${row.name}`,
      restore: async () => {
        // Bypass split rules on restore — submit the exact row back
        const { id: _drop, ...rest } = row
        await api("/api/investments", "POST", { ...rest, _skipSplit: true })
        await load()
      },
    })
  }
  const settleCard = async (card: string) => {
    const pool = ccPoolByCard[card] ?? 0
    if (pool <= 0) return
    if (!confirm(`Settle ${card} — ${fmt(pool)} MXN?\n\nThis posts a real expense and zeros the unpaid pool.`)) return
    await api("/api/cc", "PATCH", { card })
    triggerFlash()
    load()
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
      {/* ── Tab bar ── */}
      <div style={{
        display: "flex", background: C.surface,
        borderBottom: `1px solid ${C.border}`, alignItems: "stretch", flexShrink: 0,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        {TABS.map(t => {
          const on = tab === t.id
          const iconName = t.id === "Investments" ? "invest" : t.id.toLowerCase()
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "11px 2px 9px", cursor: "pointer",
              border: "none",
              borderBottom: `2px solid ${on ? C.green : "transparent"}`,
              background: "transparent",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              transition: "color .15s",
            }}>
              <Icon name={iconName} size={20} color={on ? C.green : C.muted} fill={t.id === "Overview"} />
              <span style={{ fontSize: 9.5, fontWeight: on ? 700 : 500, color: on ? C.green : C.muted, letterSpacing: "0.02em" }}>{t.label}</span>
            </button>
          )
        })}
        <button onClick={() => setQuickOpen(true)} title="Quick log" style={{
          padding: "0 13px", border: "none", borderLeft: `1px solid ${C.border}`,
          background: "transparent", color: C.green, cursor: "pointer",
          flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
        }}>
          <Icon name="plus" size={18} color={C.green} />
        </button>
        <button onClick={doRefresh} title="Refresh" style={{
          padding: "0 13px", border: "none", borderLeft: `1px solid ${C.border}`,
          background: "transparent", color: refreshing ? C.green : C.muted, cursor: "pointer",
          flexShrink: 0, transition: "transform .5s, color .3s",
          transform: refreshing ? "rotate(-180deg)" : "rotate(0deg)",
          display: "flex", alignItems: "center",
        }}>
          <Icon name="refresh" size={18} color={refreshing ? C.green : C.muted} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>

        {/* ══ OVERVIEW ══ */}
        {tab === "Overview" && (
          <div style={PAD}>
            <MonthNav moName={moName} vy={vy} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} atCurrent={isCurrentMonth()} />

            {ccWarning && (
              <div style={{
                background: C.amberDim, border: `1px solid ${C.amber}55`, borderRadius: 14,
                padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12,
              }}>
                <Icon name="warning" size={20} color={C.amber} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>Card pool is high</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>Unpaid cards ({fmt(ccPoolTotal)}) exceed 80% of cash</div>
                </div>
              </div>
            )}

            {/* Hero */}
            <Card glow={currentCash >= 0 ? C.green : C.red} style={{
              background: heroFlash ? C.greenDim : C.card,
              borderColor: heroFlash ? C.green : C.border,
              padding: "22px 20px", marginBottom: 14, transition: "background .3s, border-color .3s",
            }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>{moName} · Current cash</div>
              <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-1.5px", color: currentCash >= 0 ? C.green : C.red, lineHeight: 1 }}>
                {fmt(Math.abs(currentCash))}
                <span style={{ fontSize: 16, fontWeight: 500, color: C.muted, marginLeft: 7 }}>MXN</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, color: C.muted }}>Income − expenses − investments</div>
                {cashDelta !== null && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: deltaColor, background: deltaColor + "22", padding: "2px 9px", borderRadius: 20 }}>{deltaLabel}</span>
                )}
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11.5, color: C.muted }}>CC pool (unpaid)</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: ccWarning ? C.amber : C.text }}>{fmt(ccPoolTotal)} MXN</span>
              </div>
              <div style={{ fontSize: 10.5, color: C.dim, marginTop: 7 }}>1 USD = ${FX.toFixed(2)} MXN · live</div>
            </Card>

            {/* Stat grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Income",   val: fmt(totalIncMXN),  sub: fmt(totalIncUSD) + " USD", color: C.green },
                { label: "Spent",    val: fmt(totalExpMXN),  sub: monthExp.length + " items", color: C.red },
                { label: "Cards",    val: fmt(monthCCTotal), sub: monthCC.length + " charge" + (monthCC.length !== 1 ? "s" : ""), color: C.amber },
                { label: "Invested", val: fmt(monthInvMXN),  sub: monthInv.length + " buy" + (monthInv.length !== 1 ? "s" : ""), color: C.blue },
              ].map(m => (
                <div key={m.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "13px 14px" }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7, fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.color, letterSpacing: "-0.4px" }}>{m.val}</div>
                  <div style={{ fontSize: 10.5, color: C.dim, marginTop: 3 }}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Spending breakdown */}
            {Object.keys(catTotals).length > 0 && (
              <Card style={{ padding: 16, marginBottom: 14 }}>
                <Label>Spending — direct + cards</Label>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <Donut data={Object.entries(catTotals).map(([k, v]) => ({ label: k, v, color: CAT_COLORS[k] ?? C.muted }))} size={112} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
                    {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, amt]) => {
                      const pct = Math.round(amt / catGrand * 100)
                      return (
                        <div key={cat}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 11.5, color: C.text, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: CAT_COLORS[cat] ?? C.muted, flexShrink: 0 }} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat}</span>
                            </span>
                            <span style={{ fontSize: 11.5, color: C.muted, flexShrink: 0, marginLeft: 8 }}>{pct}%</span>
                          </div>
                          <div style={{ background: C.border, borderRadius: 20, height: 4, overflow: "hidden" }}>
                            <div style={{ width: pct + "%", height: "100%", borderRadius: 20, background: CAT_COLORS[cat] ?? C.muted, transition: "width .4s" }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Card>
            )}

            {/* Net worth = (income − expenses) + (investment_value − investment_cost) */}
            {(() => {
              const savedLatest = netWorthLine[netWorthLine.length - 1].v
              const netWorth = savedLatest + investmentPL
              return (
                <Card style={{ padding: 16, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
                    <Label style={{ marginBottom: 0 }}>Net worth · 6 mo</Label>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 19, fontWeight: 700, color: netWorth >= 0 ? C.green : C.red, letterSpacing: "-0.4px" }}>
                        {fmt(netWorth)}
                        <span style={{ fontSize: 10, color: C.muted, fontWeight: 500, marginLeft: 5 }}>MXN</span>
                      </div>
                      <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>
                        saved {fmt(savedLatest)}
                        <span style={{ color: investmentPL >= 0 ? C.green : C.red, marginLeft: 4 }}>
                          {investmentPL >= 0 ? " +" : " "}{fmt(investmentPL)} P&L
                        </span>
                      </div>
                    </div>
                  </div>
                  <LineChart points={netWorthLine} color={C.green} height={86} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    {last6.map(p => <span key={p.label} style={{ fontSize: 9, color: C.dim }}>{p.label}</span>)}
                  </div>
                  <div style={{ fontSize: 10, color: C.dim, marginTop: 6, textAlign: "center" }}>
                    Line: cumulative (income − expenses). Investment P&L is the live delta on top.
                  </div>
                </Card>
              )
            })()}

            {/* Mini charts */}
            <Card style={{ padding: 16, marginBottom: 14 }}>
              <Label>Income — last 6 months (MXN)</Label>
              <SparkBar data={incByMonth} color={C.green} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                {last6.map(p => <span key={p.label} style={{ fontSize: 9, color: C.dim }}>{p.label}</span>)}
              </div>
            </Card>
            <Card style={{ padding: 16, marginBottom: 14 }}>
              <Label>Total spending — last 6 months</Label>
              <SparkBar data={expByMonth} color={C.red} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                {last6.map(p => <span key={p.label} style={{ fontSize: 9, color: C.dim }}>{p.label}</span>)}
              </div>
            </Card>

            {/* Quick add */}
            {quickAdd && (
              <div style={{ marginBottom: 8 }}>
                {quickAdd === "expense"    && expenseForm()}
                {quickAdd === "income"     && incomeForm()}
                {quickAdd === "cc"         && ccForm()}
                {quickAdd === "investment" && invForm()}
              </div>
            )}
            <div style={{ position: "sticky", bottom: 14, display: "flex", justifyContent: "flex-end", marginTop: 8, pointerEvents: "none" }}>
              {quickAdd ? (
                <button onClick={() => setQuickAdd(null)} style={{
                  pointerEvents: "all", display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "13px 22px", fontSize: 14, fontFamily: "inherit", fontWeight: 700,
                  borderRadius: 100, cursor: "pointer", background: C.surface, color: C.muted,
                  border: `1px solid ${C.border}`,
                }}>
                  <Icon name="close" size={16} color={C.muted} />Close
                </button>
              ) : (
                <div style={{ pointerEvents: "all", display: "flex", gap: 8 }}>
                  {([
                    { t: "expense" as const,    i: "expenses", c: C.red },
                    { t: "income" as const,     i: "income",   c: C.green },
                    { t: "cc" as const,         i: "cards",    c: C.amber },
                    { t: "investment" as const, i: "invest",   c: C.blue },
                  ]).map(b => (
                    <button key={b.t} onClick={() => setQuickAdd(b.t)} style={{
                      width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 100, cursor: "pointer", background: b.c + "1F", color: b.c,
                      border: `1px solid ${b.c}44`,
                    }}>
                      <Icon name={b.i} size={20} color={b.c} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ CARDS ══ */}
        {tab === "Cards" && (
          <div style={PAD}>
            <MonthNav moName={moName} vy={vy} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} atCurrent={isCurrentMonth()} />

            <Card glow={C.amber} style={{ padding: 20, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 600 }}>Total unpaid pool</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: C.amber, letterSpacing: "-1.2px", lineHeight: 1 }}>
                {fmt(ccPoolTotal)}<span style={{ fontSize: 16, fontWeight: 500, color: C.muted, marginLeft: 7 }}>MXN</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
                {CC_CARDS.map(card => {
                  const pool = ccPoolByCard[card] ?? 0
                  return (
                    <div key={card} style={{ background: C.amberDim, borderRadius: 12, padding: 10, border: `1px solid ${C.amber}28` }}>
                      <div style={{ fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4, fontWeight: 600 }}>{card}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{fmt(pool)}</div>
                      {pool > 0 && (
                        <button onClick={() => settleCard(card)} style={{
                          marginTop: 7, width: "100%", padding: "6px 4px", fontSize: 10,
                          fontFamily: "inherit", fontWeight: 700, border: "none", borderRadius: 8,
                          cursor: "pointer", background: C.green + "26", color: C.green,
                          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                        }}>
                          <Icon name="check" size={12} color={C.green} />Settle
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>

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
                          isLast={i === arr.length - 1}
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
            <MonthNav moName={moName} vy={vy} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} atCurrent={isCurrentMonth()} />
            {showForm && expenseForm()}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "13px 16px", marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{moName} total</span>
              <span style={{ fontSize: 19, fontWeight: 700, color: C.red, letterSpacing: "-0.4px" }}>{fmt(totalExpMXN)} MXN</span>
            </div>
            <SearchBar value={search.exp} onChange={v => setSearch(s => ({ ...s, exp: v }))} placeholder="Search expenses…" />
            {(() => {
              const q = search.exp.toLowerCase()
              const filtered = monthExp.filter(e =>
                e.name.toLowerCase().includes(q) ||
                e.cat.toLowerCase().includes(q) ||
                (e.note ?? "").toLowerCase().includes(q)
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
                        isLast={i === arr.length - 1}
                        icon={<div style={{ width: 11, height: 11, borderRadius: "50%", background: CAT_COLORS[e.cat] ?? C.muted }} />}
                        iconBg={(CAT_COLORS[e.cat] ?? C.muted) + "22"}
                        name={e.name}
                        sub={`${fmtDate(e.date)} · ${e.cat}${e.note ? ` · ${e.note}` : ""}`}
                        amount={fmt(e.amount)}
                        amtColor={CAT_COLORS[e.cat] ?? C.red}
                        onDel={() => delEntry("expense", e.id)}
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
            <MonthNav moName={moName} vy={vy} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} atCurrent={isCurrentMonth()} />
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
                      isLast={i === arr.length - 1}
                      icon={<Icon name="income" size={18} color={C.green} />}
                      iconBg={C.green + "22"}
                      name={e.name}
                      sub={`${fmtDate(e.date)}${e.note ? ` · ${e.note}` : ""}`}
                      amount={fmt(e.amount) + " USD"}
                      amtColor={C.green}
                      onDel={() => delEntry("income", e.id)}
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
            <Card glow={C.blue} style={{ padding: 20, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 600 }}>Total invested · all time</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: C.blue, letterSpacing: "-1.2px", lineHeight: 1 }}>
                {fmt(totalInvAllTime)}<span style={{ fontSize: 16, fontWeight: 500, color: C.muted, marginLeft: 7 }}>MXN</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
                {BUCKETS.map(b => (
                  <div key={b.id} style={{ background: b.dim, borderRadius: 12, padding: "10px 12px", border: `1px solid ${b.color}28` }}>
                    <div style={{ fontSize: 10, color: b.color, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4, fontWeight: 600 }}>{b.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{fmt(bucketTotals[b.id])}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>MXN</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Live fund prices */}
            {Object.keys(funds).length > 0 && (
              <Card style={{ padding: 16, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Label style={{ marginBottom: 0 }}>Live fund NAV</Label>
                  <button onClick={refreshPrices} disabled={priceBusy} style={{
                    padding: "5px 10px", fontSize: 10.5, fontWeight: 700, border: "none", borderRadius: 8,
                    cursor: "pointer", background: priceBusy ? C.cardHi : C.purple, color: "#0E0F12",
                    fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5,
                  }}>
                    <Icon name="refresh" size={12} color="#0E0F12" />
                    {priceBusy ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
                {Object.entries(funds).map(([name, fund], i, arr) => {
                  const p = state.prices?.[name]
                  return (
                    <div key={name} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 0",
                      borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
                    }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{name}</div>
                        {name !== fund && <div style={{ fontSize: 10.5, color: C.dim, marginTop: 2 }}>→ {fund}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {p ? (
                          <>
                            <div style={{ fontSize: 14.5, fontWeight: 700, color: C.purple, letterSpacing: "-0.3px", fontVariantNumeric: "tabular-nums" }}>
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
              </Card>
            )}

            <ToggleRow
              value={activeInvTab}
              onChange={setActiveInvTab}
              options={[{ value: "portfolio", label: "Portfolio" }, { value: "pl", label: "P&L" }, { value: "history", label: "History" }, { value: "maps", label: "Maps" }]}
            />

            {activeInvTab === "portfolio" && (
              <>
                <Card style={{ padding: 16, marginBottom: 14 }}>
                  <Label>Cumulative invested</Label>
                  <LineChart points={invCumLine} color={C.blue} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    {last6.map(p => <span key={p.label} style={{ fontSize: 9, color: C.dim }}>{p.label}</span>)}
                  </div>
                </Card>
                {BUCKETS.map(b => {
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
                  <div style={{ fontSize: 11, color: C.muted }}>Stocks + funds · set ticker for auto-refresh</div>
                  <button
                    onClick={refreshPrices}
                    disabled={priceBusy || Object.keys(tickers).length === 0}
                    style={{
                      padding: "7px 13px", fontSize: 11.5, fontWeight: 700,
                      border: "none", borderRadius: 10, cursor: "pointer",
                      background: priceBusy ? C.cardHi : C.blue, color: "#0E0F12",
                      fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
                      opacity: Object.keys(tickers).length === 0 ? 0.5 : 1,
                    }}
                  >
                    <Icon name="refresh" size={13} color="#0E0F12" />
                    {priceBusy ? "Refreshing…" : "Refresh prices"}
                  </button>
                </div>
                {Object.entries(invByName).length === 0 ? (
                  <Empty icon="invest" label="No stock positions yet" sub="Log a buy to start tracking" />
                ) : (
                  Object.entries(invByName).map(([key, { name, gf, cost, shares }]) => {
                    const p = state.prices?.[name]
                    const cur = p?.price ?? 0
                    const valMXN = shares > 0 ? shares * cur * FX : 0
                    const plMXN = shares > 0 && cur > 0 ? valMXN - cost : 0
                    const plPct = cost > 0 && shares > 0 && cur > 0 ? (plMXN / cost * 100) : 0
                    return (
                      <Card key={key} style={{ padding: "14px 16px", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: cur > 0 ? 12 : 0 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 11, background: C.blueDim,
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            fontSize: 13, fontWeight: 700, color: C.blue,
                          }}>{name.slice(0, 2).toUpperCase()}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                              {name}<Tag color={gf ? C.purple : C.blue}>{gf ? "GF" : "Mine"}</Tag>
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
                {Object.keys(fundByName).length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, margin: "18px 0 10px" }}>Funds (MXN)</div>
                    {Object.entries(fundByName).map(([key, { name, gf, cost, shares, uncoveredCost }]) => {
                      const p = state.prices?.[name]
                      const cur = p?.price ?? 0   // fund NAV in MXN
                      const valMXN = shares > 0 ? shares * cur : 0
                      // P&L only counts cost that has a known purchase_nav
                      const coveredCost = cost - uncoveredCost
                      const plMXN = shares > 0 && cur > 0 ? valMXN - coveredCost : 0
                      const plPct = coveredCost > 0 && shares > 0 && cur > 0 ? (plMXN / coveredCost * 100) : 0
                      return (
                        <Card key={key} style={{ padding: "14px 16px", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: cur > 0 ? 12 : 0 }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: 11, background: C.purpleDim,
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                              fontSize: 13, fontWeight: 700, color: C.purple,
                            }}>{name.slice(0, 2).toUpperCase()}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                                {name}<Tag color={gf ? C.pink : C.purple}>{gf ? "GF" : "Mine"}</Tag>
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
                  const filtered = state.investments.filter(e => e.name.toLowerCase().includes(search.inv.toLowerCase()))
                  return filtered.length === 0 ? (
                    <Empty icon="invest" label="No investments logged yet" sub={search.inv ? "Try a different search" : "Log a buy to start"} />
                  ) : (
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
                      {[...filtered].sort((a, b) => b.date.localeCompare(a.date)).map((e, i, arr) => {
                        const bucket = getBucket(e)
                        return (
                          <EntryRow
                            key={e.id}
                            isLast={i === arr.length - 1}
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

      {/* Global quick-log sheet */}
      <QuickLogSheet open={quickOpen} onClose={() => setQuickOpen(false)} onLogged={load} />

      {/* Undo toast */}
      {toast && (
        <div style={{
          position: "fixed", left: 14, right: 14, bottom: 80, zIndex: 100,
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
