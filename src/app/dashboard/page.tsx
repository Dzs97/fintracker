"use client"
/**
 * Main dashboard — client component that mirrors the artifact UI
 * but backed by the real API. All state lives in Redis via API calls.
 */
import { useEffect, useState, useCallback } from "react"
import type { AppState } from "@/types"
import { fmt, fmtDate, expandCC, CAT_COLORS } from "@/lib/utils"

const TABS = [
  { id: "Overview",     icon: "📊" },
  { id: "Cards",        icon: "💳" },
  { id: "Expenses",     icon: "🧾" },
  { id: "Income",       icon: "💵" },
  { id: "Investments",  icon: "📈" },
  { id: "Settings",     icon: "⚙️"  },
]

const CC_CARDS = ["OpenBank", "Amex", "Invex"] as const
const CATS = Object.keys(CAT_COLORS)
const BUCKETS = [
  { id: "my-fund",  label: "My Funds",  gf: false, type: "fund",  color: "#5B9FFF" },
  { id: "my-stock", label: "My Stocks", gf: false, type: "stock", color: "#00E5A0" },
  { id: "gf-fund",  label: "GF Funds",  gf: true,  type: "fund",  color: "#A78BFA" },
  { id: "gf-stock", label: "GF Stocks", gf: true,  type: "stock", color: "#FF6BAA" },
]

function today() { return new Date().toISOString().split("T")[0] }

async function api(path: string, method = "GET", body?: unknown) {
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
  const [tab, setTab] = useState("Overview")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }
  })
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState({ exp: "", inc: "", cc: "", inv: "" })
  const [activeInvTab, setActiveInvTab] = useState("portfolio")
  const [form, setForm] = useState({
    expName: "", expAmt: "", expCat: "Food & Dining", expDate: today(), expNote: "",
    incName: "", incAmt: "", incDate: today(), incNote: "",
    ccName: "", ccAmt: "", ccDate: today(), ccCat: "Food & Dining", ccCard: "OpenBank", ccInstallments: 1,
    invName: "", invAmt: "", invDate: today(), invNote: "", invGf: false, invType: "fund",
    budgetCat: "Food & Dining", budgetLimit: "",
  })

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const [entries, ccData, invData, budgets, fx] = await Promise.all([
        api("/api/entries"),
        api("/api/cc"),
        api("/api/investments"),
        api("/api/budgets"),
        api("/api/fx"),
      ])
      setState({
        expenses:    entries.expenses,
        income:      entries.income,
        cc:          ccData.cc,
        settled:     ccData.settled,
        investments: invData.investments,
        prices:      invData.prices,
        budgets:     budgets.budgets,
        fxRate:      fx.rate ?? 17.3,
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setShowForm(false) }, [tab])

  if (loading || !state) {
    return <div className="flex items-center justify-center min-h-screen text-muted text-sm">Loading…</div>
  }

  const FX = state.fxRate
  const { y: vy, m: vm } = viewMonth
  const moName = new Date(vy, vm, 1).toLocaleString("en-US", { month: "long" })
  const isCurrentMonth = () => { const n = new Date(); return n.getFullYear() === vy && n.getMonth() === vm }
  const shiftMonth = (d: number) => { const nd = new Date(vy, vm + d, 1); setViewMonth({ y: nd.getFullYear(), m: nd.getMonth() }) }
  const inMonth = (str: string) => { const [y, m] = str.split("-").map(Number); return y === vy && m - 1 === vm }

  const ccExpanded = expandCC(state.cc)
  const monthExp = state.expenses.filter(e => inMonth(e.date))
  const monthInc = state.income.filter(e => inMonth(e.date))
  const monthInv = state.investments.filter(e => inMonth(e.date))
  const monthCC  = ccExpanded.filter(e => inMonth(e.date))

  const totalExpMXN  = monthExp.reduce((s, e) => s + e.amount, 0)
  const totalIncUSD  = monthInc.reduce((s, e) => s + e.amount, 0)
  const totalIncMXN  = totalIncUSD * FX
  const totalInvAll  = state.investments.reduce((s, e) => s + e.amount, 0)
  const monthInvMXN  = monthInv.filter(e => !e.historical).reduce((s, e) => s + e.amount, 0)
  const monthCCTotal = monthCC.reduce((s, e) => s + e.amount, 0)
  const currentCash  = totalIncMXN - totalExpMXN - monthInvMXN

  const ccPoolByCard: Record<string, number> = {}
  CC_CARDS.forEach(card => {
    const raw = state.cc.filter(e => e.card === card).reduce((s, e) => s + e.amount, 0)
    ccPoolByCard[card] = Math.max(0, raw - (state.settled[card] ?? 0))
  })
  const ccPoolTotal = Object.values(ccPoolByCard).reduce((s, v) => s + v, 0)
  const ccWarning   = ccPoolTotal > currentCash * 0.8

  const catTotals: Record<string, number> = {}
  monthExp.forEach(e => { catTotals[e.cat] = (catTotals[e.cat] ?? 0) + e.amount })
  monthCC.forEach(e  => { catTotals[e.cat] = (catTotals[e.cat] ?? 0) + e.amount })
  const catGrand = Object.values(catTotals).reduce((s, v) => s + v, 0)

  const upd = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const addExpense = async () => {
    if (!form.expName || !form.expAmt) return
    await api("/api/entries", "POST", { type: "expense", name: form.expName, amount: parseFloat(form.expAmt), cat: form.expCat, date: form.expDate || today(), note: form.expNote })
    setForm(f => ({ ...f, expName: "", expAmt: "", expNote: "" }))
    setShowForm(false); load()
  }
  const addIncome = async () => {
    if (!form.incName || !form.incAmt) return
    await api("/api/entries", "POST", { type: "income", name: form.incName, amount: parseFloat(form.incAmt), date: form.incDate || today(), note: form.incNote })
    setForm(f => ({ ...f, incName: "", incAmt: "", incNote: "" }))
    setShowForm(false); load()
  }
  const addCC = async () => {
    if (!form.ccName || !form.ccAmt) return
    await api("/api/cc", "POST", { name: form.ccName, amount: parseFloat(form.ccAmt), date: form.ccDate || today(), cat: form.ccCat, card: form.ccCard, installments: Number(form.ccInstallments) || 1 })
    setForm(f => ({ ...f, ccName: "", ccAmt: "", ccInstallments: 1 }))
    setShowForm(false); load()
  }
  const addInvestment = async () => {
    if (!form.invName || !form.invAmt) return
    await api("/api/investments", "POST", { name: form.invName, amount: parseFloat(form.invAmt), date: form.invDate || today(), note: form.invNote, gf: form.invGf, inv_type: form.invType })
    setForm(f => ({ ...f, invName: "", invAmt: "", invNote: "" }))
    setShowForm(false); load()
  }
  const delEntry = async (type: string, id: string) => {
    await api("/api/entries", "DELETE", { type, id }); load()
  }
  const delCC = async (id: string) => { await api("/api/cc", "DELETE", { id }); load() }
  const delInv = async (id: string) => { await api("/api/investments", "DELETE", { id }); load() }
  const settleCard = async (card: string) => { await api("/api/cc", "PATCH", { card }); load() }
  const updatePrice = async (ticker: string, price: number) => { await api("/api/investments", "PATCH", { ticker, price }); load() }
  const saveBudget = async () => {
    if (!form.budgetLimit) return
    await api("/api/budgets", "POST", { cat: form.budgetCat, limitMXN: parseFloat(form.budgetLimit) }); load()
  }
  const delBudget = async (cat: string) => { await api("/api/budgets", "DELETE", { cat }); load() }

  const I = (k: string) => `bg-[${CAT_COLORS[k] ?? "#888"}]`

  // Shared UI atoms
  const inp = "w-full px-3 py-3 text-sm border border-border rounded-xl bg-surface text-text outline-none mb-2.5 focus:border-hi"
  const lbl = "text-[10px] text-muted uppercase tracking-widest block mb-1.5"

  const SectionLabel = ({ children }: { children: string }) => (
    <div className="text-[10px] text-muted uppercase tracking-widest font-medium mb-2.5">{children}</div>
  )

  const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-card border border-border rounded-2xl p-4 mb-3 ${className}`}>{children}</div>
  )

  const MonthNav = () => (
    <div className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-2.5 mb-3">
      <button onClick={() => shiftMonth(-1)} className="text-muted text-xl px-1">‹</button>
      <span className="text-sm font-semibold">{moName} {vy}</span>
      <button onClick={() => shiftMonth(1)} disabled={isCurrentMonth()} className="text-muted text-xl px-1 disabled:opacity-30">›</button>
    </div>
  )

  const Toggle = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
    <div className="flex bg-surface border border-border rounded-xl p-0.5 mb-2.5">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`flex-1 py-2 text-xs rounded-lg font-medium transition-all ${value === o.value ? "bg-card text-text" : "text-muted"}`}>
          {o.label}
        </button>
      ))}
    </div>
  )

  const FormSheet = ({ title, children, onSubmit, label }: { title: string; children: React.ReactNode; onSubmit: () => void; label: string }) => (
    <div className="bg-surface border border-border rounded-2xl p-4 mb-4">
      <div className="text-sm font-semibold mb-4">{title}</div>
      {children}
      <div className="flex gap-2 mt-2">
        <button onClick={() => setShowForm(false)} className="flex-1 py-3 text-sm border border-border rounded-xl text-muted">Cancel</button>
        <button onClick={onSubmit} className="flex-[2] py-3 text-sm font-semibold rounded-xl bg-green text-bg">
          {label}
        </button>
      </div>
    </div>
  )

  const FAB = ({ label, onClick, color = "bg-green" }: { label: string; onClick: () => void; color?: string }) => (
    <div className="sticky bottom-4 flex justify-end mt-3 pointer-events-none">
      <button onClick={onClick} className={`pointer-events-auto px-5 py-3 text-sm font-semibold rounded-full ${color} text-bg`}>{label}</button>
    </div>
  )

  const EntryRow = ({ iconBg, iconEl, name, sub, amount, amtColor, onDel }: { iconBg: string; iconEl: React.ReactNode; name: React.ReactNode; sub: string; amount: string; amtColor: string; onDel?: () => void }) => (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>{iconEl}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className="text-[11px] text-muted mt-0.5">{sub}</div>
      </div>
      <div className="text-sm font-semibold flex-shrink-0" style={{ color: amtColor }}>{amount}</div>
      {onDel && <button onClick={onDel} className="text-dim text-lg px-1 leading-none flex-shrink-0">×</button>}
    </div>
  )

  const SearchBar = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <div className="relative mb-3">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">🔍</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? "Search…"}
        className="w-full pl-9 pr-8 py-2.5 text-sm border border-border rounded-xl bg-surface text-text outline-none" />
      {value && <button onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted text-base">×</button>}
    </div>
  )

  const Empty = ({ icon, label, sub }: { icon: string; label: string; sub?: string }) => (
    <div className="text-center py-12">
      <div className="text-4xl mb-3 opacity-40">{icon}</div>
      <div className="text-sm font-medium text-muted mb-1">{label}</div>
      {sub && <div className="text-xs text-dim">{sub}</div>}
    </div>
  )

  const BarChart = ({ data, color, height = 60 }: { data: { label: string; v: number }[]; color: string; height?: number }) => {
    if (!data.length) return null
    const max = Math.max(...data.map(d => d.v), 1)
    const W = 280, H = height, gap = 6
    const bw = Math.max(6, Math.floor((W - gap * (data.length - 1)) / data.length))
    const gridYs = [0.25, 0.5, 0.75, 1].map(p => Math.round(H - p * H))
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        {gridYs.map(y => <line key={y} x1={0} y1={y} x2={W} y2={y} stroke="#1E1E2E" strokeWidth="1" />)}
        {data.map((d, i) => {
          const bh = Math.max(3, Math.round((d.v / max) * H))
          return <rect key={i} x={i * (bw + gap)} y={H - bh} width={bw} height={bh} rx={3} fill={color} opacity={0.85}><title>{d.label}: {fmt(d.v)}</title></rect>
        })}
      </svg>
    )
  }

  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(vy, vm - 5 + i, 1)
    return { m: d.getMonth(), y: d.getFullYear(), label: d.toLocaleString("en-US", { month: "short" }) }
  })
  const incByMonth = last6.map(p => ({ label: p.label, v: state.income.filter(e => { const d = new Date(e.date); return d.getMonth() === p.m && d.getFullYear() === p.y }).reduce((s, e) => s + e.amount * FX, 0) }))
  const expByMonth = last6.map(p => ({ label: p.label, v: [...state.expenses, ...expandCC(state.cc)].filter(e => { const d = new Date(e.date); return d.getMonth() === p.m && d.getFullYear() === p.y }).reduce((s, e) => s + e.amount, 0) }))
  const invCumLine = last6.map(p => ({ label: p.label, v: state.investments.filter(e => { const d = new Date(e.date); return d.getFullYear() < p.y || (d.getFullYear() === p.y && d.getMonth() <= p.m) }).reduce((s, e) => s + e.amount, 0) }))

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-bg">

      {/* Tab bar */}
      <div className="flex bg-surface border-b border-border sticky top-0 z-20">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-[9px] uppercase tracking-widest border-b-2 transition-colors ${tab === t.id ? "border-green text-green font-semibold" : "border-transparent text-muted"}`}>
            <span className="text-lg leading-none">{t.icon}</span>{t.id}
          </button>
        ))}
        <button onClick={load} className={`px-3 border-l border-border text-muted text-lg border-b-2 border-transparent transition-all ${refreshing ? "text-green rotate-180" : ""}`}>↻</button>
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "Overview" && (
        <div className="p-3.5">
          <MonthNav />

          {ccWarning && (
            <div className="flex items-center gap-3 bg-[#2E1F0A] border border-amber/30 rounded-xl p-3 mb-3">
              <span className="text-xl">⚠️</span>
              <div>
                <div className="text-sm font-semibold text-amber">CC pool is high</div>
                <div className="text-xs text-muted">Unpaid cards ({fmt(ccPoolTotal)}) exceed 80% of cash</div>
              </div>
            </div>
          )}

          {/* Hero */}
          <Card className="relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-5" style={{ background: currentCash >= 0 ? "#00E5A0" : "#FF5B6B" }} />
            <div className="text-[10px] text-muted uppercase tracking-widest mb-2">{moName} · Current cash</div>
            <div className="text-[38px] font-bold tracking-tight leading-none mb-1" style={{ color: currentCash >= 0 ? "#00E5A0" : "#FF5B6B" }}>
              {fmt(Math.abs(currentCash))}<span className="text-sm font-normal text-muted ml-1.5">MXN</span>
            </div>
            <div className="text-xs text-muted">Income − direct expenses − investments</div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
              <span className="text-xs text-muted">CC pool (unpaid)</span>
              <span className={`text-sm font-semibold ${ccWarning ? "text-amber" : "text-muted"}`}>{fmt(ccPoolTotal)} MXN</span>
            </div>
            <div className="text-[10px] text-dim mt-1.5">1 USD = ${FX.toFixed(2)} MXN · live rate</div>
          </Card>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label: "Income",   val: fmt(totalIncMXN),  sub: `${fmt(totalIncUSD)} USD`, color: "#00E5A0" },
              { label: "Spent",    val: fmt(totalExpMXN),  sub: `${monthExp.length} items`, color: "#FF5B6B" },
              { label: "Cards",    val: fmt(monthCCTotal), sub: `${monthCC.length} charges`, color: "#FFB547" },
              { label: "Invested", val: fmt(monthInvMXN),  sub: `${monthInv.length} buys`, color: "#5B9FFF" },
            ].map(m => (
              <div key={m.label} className="bg-card border border-border rounded-2xl p-3">
                <div className="text-[10px] text-muted uppercase tracking-widest mb-1.5">{m.label}</div>
                <div className="text-base font-semibold" style={{ color: m.color }}>{m.val}</div>
                <div className="text-[10px] text-dim mt-1">{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          {Object.keys(catTotals).length > 0 && (
            <Card>
              <SectionLabel>Spending breakdown — direct + cards</SectionLabel>
              <div className="flex flex-col gap-2">
                {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                  const pct = Math.round(amt / catGrand * 100)
                  const budget = state.budgets.find(b => b.cat === cat)
                  const overBudget = budget && amt > budget.limitMXN
                  return (
                    <div key={cat}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: CAT_COLORS[cat] ?? "#888" }} />
                          {cat}
                          {overBudget && <span className="text-[9px] text-red bg-red/10 px-1.5 py-0.5 rounded-full">over budget</span>}
                        </span>
                        <span className="text-xs text-muted">{pct}%</span>
                      </div>
                      <div className="bg-border rounded-full h-1 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: overBudget ? "#FF5B6B" : (CAT_COLORS[cat] ?? "#888"), transition: "width .4s" }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <Card>
            <SectionLabel>Income — last 6 months (MXN)</SectionLabel>
            <BarChart data={incByMonth} color="#00E5A0" />
            <div className="flex justify-between mt-2">{last6.map(p => <span key={p.label} className="text-[9px] text-dim">{p.label}</span>)}</div>
          </Card>
          <Card>
            <SectionLabel>Total spending — last 6 months</SectionLabel>
            <BarChart data={expByMonth} color="#FF5B6B" />
            <div className="flex justify-between mt-2">{last6.map(p => <span key={p.label} className="text-[9px] text-dim">{p.label}</span>)}</div>
          </Card>
        </div>
      )}

      {/* ── CARDS ── */}
      {tab === "Cards" && (
        <div className="p-3.5">
          <MonthNav />
          <Card className="relative overflow-hidden">
            <div className="absolute -top-5 -right-5 w-24 h-24 rounded-full opacity-5 bg-amber" />
            <div className="text-[10px] text-muted uppercase tracking-widest mb-1.5">Total unpaid pool</div>
            <div className="text-[34px] font-bold text-amber tracking-tight leading-none mb-3">{fmt(ccPoolTotal)}<span className="text-sm font-normal text-muted ml-1.5">MXN</span></div>
            <div className="grid grid-cols-3 gap-2">
              {CC_CARDS.map(card => {
                const pool = ccPoolByCard[card] ?? 0
                return (
                  <div key={card} className="bg-[#2E1F0A] rounded-xl p-2.5 border border-amber/20">
                    <div className="text-[9px] text-amber uppercase tracking-widest mb-1">💳 {card}</div>
                    <div className="text-sm font-semibold">{fmt(pool)}</div>
                    {pool > 0 && <button onClick={() => settleCard(card)} className="mt-1.5 w-full py-1 text-[10px] font-semibold rounded bg-green/20 text-green">✓ Settle</button>}
                  </div>
                )
              })}
            </div>
          </Card>

          {showForm && (
            <FormSheet title="Add card charge" onSubmit={addCC} label="Add charge">
              <label className={lbl}>Description</label>
              <input className={inp} value={form.ccName} onChange={e => upd("ccName", e.target.value)} placeholder="UberEats, restaurant…" />
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Amount (MXN)</label><input className={inp} type="number" value={form.ccAmt} onChange={e => upd("ccAmt", e.target.value)} placeholder="0.00" /></div>
                <div><label className={lbl}>Date</label><input className={inp} type="date" value={form.ccDate} onChange={e => upd("ccDate", e.target.value)} /></div>
              </div>
              <label className={lbl}>Card</label>
              <Toggle value={form.ccCard} onChange={v => upd("ccCard", v)} options={CC_CARDS.map(c => ({ value: c, label: c }))} />
              <label className={lbl}>Installments</label>
              <div className="flex items-center gap-2 mb-2.5">
                <input className={`${inp} !w-16 !mb-0`} type="number" min="1" max="48" value={form.ccInstallments} onChange={e => upd("ccInstallments", e.target.value)} />
                <span className="text-xs text-muted">month{form.ccInstallments > 1 ? "s" : ""}{form.ccInstallments > 1 ? ` → ${fmt(parseFloat(form.ccAmt || "0") / Number(form.ccInstallments))}/mo` : ""}</span>
              </div>
              <label className={lbl}>Category</label>
              <select className={inp} value={form.ccCat} onChange={e => upd("ccCat", e.target.value)}>{CATS.map(c => <option key={c}>{c}</option>)}</select>
            </FormSheet>
          )}

          <SearchBar value={search.cc} onChange={v => setSearch(s => ({ ...s, cc: v }))} placeholder="Search charges…" />
          {(() => {
            const filtered = monthCC.filter(e => e.name.toLowerCase().includes(search.cc.toLowerCase()))
            const total = filtered.reduce((s, e) => s + e.amount, 0)
            return filtered.length === 0
              ? <Empty icon="💳" label="No charges this month" sub={search.cc ? "Try a different search" : undefined} />
              : (
                <>
                  <div className="bg-card border border-border rounded-2xl overflow-hidden mb-2">
                    {[...filtered].sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                      <EntryRow key={e.id}
                        iconBg="#2E1F0A" iconEl={<div className="w-2.5 h-2.5 rounded-sm bg-amber" />}
                        name={e.name} sub={`${fmtDate(e.date)} · ${e.card} · ${e.cat}`}
                        amount={fmt(e.amount)} amtColor="#FFB547"
                        onDel={"installmentOf" in e ? undefined : () => delCC(e.id)}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between px-1 text-xs text-muted">
                    <span>{filtered.length} charge{filtered.length !== 1 ? "s" : ""}</span>
                    <span className="font-semibold text-amber">{fmt(total)} MXN total</span>
                  </div>
                </>
              )
          })()}
          <FAB label={showForm ? "✕ Close" : "+ Add charge"} onClick={() => setShowForm(v => !v)} color="bg-amber" />
        </div>
      )}

      {/* ── EXPENSES ── */}
      {tab === "Expenses" && (
        <div className="p-3.5">
          <MonthNav />
          {showForm && (
            <FormSheet title="New expense" onSubmit={addExpense} label="Add expense">
              <label className={lbl}>Description</label>
              <input className={inp} value={form.expName} onChange={e => upd("expName", e.target.value)} placeholder="Coffee, rent…" />
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Amount (MXN)</label><input className={inp} type="number" value={form.expAmt} onChange={e => upd("expAmt", e.target.value)} placeholder="0.00" /></div>
                <div><label className={lbl}>Date</label><input className={inp} type="date" value={form.expDate} onChange={e => upd("expDate", e.target.value)} /></div>
              </div>
              <label className={lbl}>Category</label>
              <select className={inp} value={form.expCat} onChange={e => upd("expCat", e.target.value)}>{CATS.map(c => <option key={c}>{c}</option>)}</select>
              <label className={lbl}>Note (optional)</label>
              <input className={inp} value={form.expNote} onChange={e => upd("expNote", e.target.value)} placeholder="DolarApp, notes…" />
            </FormSheet>
          )}
          <div className="flex justify-between items-center bg-card border border-border rounded-xl px-4 py-3 mb-3">
            <span className="text-xs text-muted">{moName} total</span>
            <span className="text-lg font-semibold text-red">{fmt(totalExpMXN)} MXN</span>
          </div>
          <SearchBar value={search.exp} onChange={v => setSearch(s => ({ ...s, exp: v }))} placeholder="Search expenses…" />
          {(() => {
            const filtered = monthExp.filter(e => [e.name, e.cat, e.note ?? ""].join(" ").toLowerCase().includes(search.exp.toLowerCase()))
            const total = filtered.reduce((s, e) => s + e.amount, 0)
            return filtered.length === 0
              ? <Empty icon="🧾" label="No expenses this month" sub={search.exp ? "Try a different search" : "Tap + to add one"} />
              : (
                <>
                  <div className="bg-card border border-border rounded-2xl overflow-hidden mb-2">
                    {[...filtered].sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                      <EntryRow key={e.id}
                        iconBg={(CAT_COLORS[e.cat] ?? "#888") + "22"}
                        iconEl={<div className="w-2.5 h-2.5 rounded-full" style={{ background: CAT_COLORS[e.cat] ?? "#888" }} />}
                        name={e.name} sub={`${fmtDate(e.date)} · ${e.cat}${e.note ? ` · ${e.note}` : ""}`}
                        amount={fmt(e.amount)} amtColor={CAT_COLORS[e.cat] ?? "#FF5B6B"}
                        onDel={() => delEntry("expense", e.id)}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between px-1 text-xs text-muted">
                    <span>{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
                    <span className="font-semibold text-red">{fmt(total)} MXN total</span>
                  </div>
                </>
              )
          })()}
          <FAB label={showForm ? "✕ Close" : "+ Add expense"} onClick={() => setShowForm(v => !v)} color="bg-red" />
        </div>
      )}

      {/* ── INCOME ── */}
      {tab === "Income" && (
        <div className="p-3.5">
          <MonthNav />
          {showForm && (
            <FormSheet title="New income" onSubmit={addIncome} label="Add income">
              <label className={lbl}>Source</label>
              <input className={inp} value={form.incName} onChange={e => upd("incName", e.target.value)} placeholder="Salary, freelance…" />
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Amount (USD)</label><input className={inp} type="number" value={form.incAmt} onChange={e => upd("incAmt", e.target.value)} placeholder="0.00" /></div>
                <div><label className={lbl}>Date</label><input className={inp} type="date" value={form.incDate} onChange={e => upd("incDate", e.target.value)} /></div>
              </div>
              <label className={lbl}>Note (optional)</label>
              <input className={inp} value={form.incNote} onChange={e => upd("incNote", e.target.value)} placeholder="Optional" />
            </FormSheet>
          )}
          <div className="flex justify-between items-center bg-card border border-border rounded-xl px-4 py-3 mb-3">
            <span className="text-xs text-muted">{moName} total</span>
            <div className="text-right">
              <div className="text-lg font-semibold text-green">{fmt(totalIncUSD)} USD</div>
              <div className="text-xs text-muted">{fmt(totalIncMXN)} MXN equiv.</div>
            </div>
          </div>
          <SearchBar value={search.inc} onChange={v => setSearch(s => ({ ...s, inc: v }))} placeholder="Search income…" />
          {(() => {
            const filtered = monthInc.filter(e => e.name.toLowerCase().includes(search.inc.toLowerCase()))
            return filtered.length === 0
              ? <Empty icon="💵" label="No income this month" sub={search.inc ? "Try a different search" : "Tap + to add one"} />
              : (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  {[...filtered].sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                    <EntryRow key={e.id}
                      iconBg="#00E5A022" iconEl={<span className="text-green text-base font-bold">↑</span>}
                      name={e.name} sub={`${fmtDate(e.date)}${e.note ? ` · ${e.note}` : ""}`}
                      amount={`${fmt(e.amount, 0)} USD`} amtColor="#00E5A0"
                      onDel={() => delEntry("income", e.id)}
                    />
                  ))}
                </div>
              )
          })()}
          <FAB label={showForm ? "✕ Close" : "+ Add income"} onClick={() => setShowForm(v => !v)} color="bg-green" />
        </div>
      )}

      {/* ── INVESTMENTS ── */}
      {tab === "Investments" && (
        <div className="p-3.5">
          <Card className="relative overflow-hidden">
            <div className="absolute -top-5 -right-5 w-24 h-24 rounded-full opacity-5 bg-blue" />
            <div className="text-[10px] text-muted uppercase tracking-widest mb-1.5">Total invested · All time</div>
            <div className="text-[34px] font-bold text-blue tracking-tight leading-none mb-3">{fmt(totalInvAll)}<span className="text-sm font-normal text-muted ml-1.5">MXN</span></div>
            <div className="grid grid-cols-2 gap-2">
              {BUCKETS.map(b => {
                const total = state.investments.filter(i => i.gf === b.gf && i.inv_type === b.type).reduce((s, i) => s + i.amount, 0)
                return (
                  <div key={b.id} className="rounded-xl p-2.5 border" style={{ background: b.color + "15", borderColor: b.color + "30" }}>
                    <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: b.color }}>{b.label}</div>
                    <div className="text-sm font-semibold">{fmt(total)}</div>
                    <div className="text-[10px] text-dim mt-0.5">MXN</div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Toggle value={activeInvTab} onChange={setActiveInvTab} options={[{ value: "portfolio", label: "Portfolio" }, { value: "pl", label: "P&L" }, { value: "history", label: "History" }]} />

          {activeInvTab === "portfolio" && (
            <>
              <Card>
                <SectionLabel>Cumulative invested</SectionLabel>
                <BarChart data={invCumLine} color="#5B9FFF" height={70} />
                <div className="flex justify-between mt-2">{last6.map(p => <span key={p.label} className="text-[9px] text-dim">{p.label}</span>)}</div>
              </Card>
              {BUCKETS.map(b => {
                const assets = Object.entries(
                  state.investments.filter(i => i.gf === b.gf && i.inv_type === b.type).reduce((map, i) => {
                    map[i.name] = (map[i.name] ?? 0) + i.amount; return map
                  }, {} as Record<string, number>)
                ).sort((a, b) => b[1] - a[1])
                const total = assets.reduce((s, [, v]) => s + v, 0)
                if (!assets.length) return null
                return (
                  <div key={b.id} className="rounded-2xl p-4 mb-3 border" style={{ background: "#16161F", borderColor: b.color + "44" }}>
                    <div className="flex justify-between items-center mb-3">
                      <div className="text-xs font-semibold" style={{ color: b.color }}>{b.label}</div>
                      <div className="text-sm font-semibold">{fmt(total)} MXN</div>
                    </div>
                    {assets.map(([name, amt], i) => {
                      const pct = Math.round(amt / total * 100)
                      return (
                        <div key={name} className={i < assets.length - 1 ? "mb-3" : ""}>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-sm">{name}</span>
                            <span className="text-xs text-muted">{fmt(amt)} <span className="text-dim">({pct}%)</span></span>
                          </div>
                          <div className="bg-border rounded-full h-1.5 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: b.color, opacity: 0.8, transition: "width .4s" }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}

          {activeInvTab === "pl" && (
            <div className="mb-3">
              <div className="text-[10px] text-muted mb-2.5">Stocks only · tap price field to update</div>
              {(() => {
                const positions: Record<string, { name: string; gf: boolean; cost: number; shares: number }> = {}
                state.investments.filter(i => i.inv_type === "stock").forEach(i => {
                  const key = `${i.name}||${i.gf ? "gf" : "me"}`
                  if (!positions[key]) positions[key] = { name: i.name, gf: i.gf, cost: 0, shares: 0 }
                  positions[key].cost += i.amount
                  if (i.purchase_price) positions[key].shares += i.amount / (i.purchase_price * FX)
                })
                return Object.entries(positions).length === 0
                  ? <Empty icon="📈" label="No stock positions" sub="Log a buy to start" />
                  : Object.entries(positions).map(([key, { name, gf, cost, shares }]) => {
                    const p = state.prices[name]
                    const currentUSD = p?.price ?? 0
                    const currentValMXN = shares > 0 ? shares * currentUSD * FX : 0
                    const plMXN = shares > 0 && currentUSD > 0 ? currentValMXN - cost : 0
                    const plPct = cost > 0 && shares > 0 && currentUSD > 0 ? (plMXN / cost * 100) : 0
                    return (
                      <div key={key} className="bg-card border border-border rounded-2xl p-4 mb-2.5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-[10px] bg-[#0A1A2E] flex items-center justify-center text-blue text-xs font-bold">{name.slice(0, 2).toUpperCase()}</div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold flex items-center gap-1.5">
                              {name}
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: gf ? "#A78BFA28" : "#5B9FFF28", color: gf ? "#A78BFA" : "#5B9FFF" }}>{gf ? "GF" : "Mine"}</span>
                            </div>
                            <div className="text-[11px] text-muted mt-0.5">{shares > 0 ? `${shares.toFixed(4)} shares · ` : ""}Cost: {fmt(cost)} MXN</div>
                          </div>
                          {shares > 0 && currentUSD > 0 && (
                            <div className="text-right">
                              <div className="text-sm font-bold" style={{ color: plMXN >= 0 ? "#00E5A0" : "#FF5B6B" }}>{plMXN >= 0 ? "+" : ""}{fmt(plMXN)}</div>
                              <div className="text-[11px]" style={{ color: plMXN >= 0 ? "#00E5A0" : "#FF5B6B" }}>{plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%</div>
                            </div>
                          )}
                        </div>
                        {currentUSD > 0 && (
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="bg-surface rounded-xl p-2.5">
                              <div className="text-[9px] text-muted mb-1">CURRENT PRICE</div>
                              <div className="text-sm font-semibold text-blue">${currentUSD.toFixed(2)} USD</div>
                              <div className="text-[10px] text-dim">{fmt(currentUSD * FX)} MXN</div>
                            </div>
                            <div className="bg-surface rounded-xl p-2.5">
                              <div className="text-[9px] text-muted mb-1">POSITION VALUE</div>
                              <div className="text-sm font-semibold">{fmt(currentValMXN)} MXN</div>
                              {p?.updatedAt && <div className="text-[10px] text-dim">{fmtDate(p.updatedAt.split("T")[0])}</div>}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input type="number" placeholder="Update price (USD)" min="0" step="0.01" defaultValue={currentUSD || ""}
                            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-surface text-text outline-none"
                            onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) updatePrice(name, v) }} />
                          <span className="text-xs text-muted">USD</span>
                        </div>
                      </div>
                    )
                  })
              })()}
            </div>
          )}

          {activeInvTab === "history" && (
            <>
              <SearchBar value={search.inv} onChange={v => setSearch(s => ({ ...s, inv: v }))} placeholder="Search investments…" />
              {(() => {
                const filtered = state.investments.filter(e => e.name.toLowerCase().includes(search.inv.toLowerCase()))
                return filtered.length === 0
                  ? <Empty icon="📈" label="No investments" sub="Log a buy to start" />
                  : (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden mb-3">
                      {[...filtered].sort((a, b) => b.date.localeCompare(a.date)).map(e => {
                        const b = BUCKETS.find(bk => bk.gf === e.gf && bk.type === e.inv_type) ?? BUCKETS[1]
                        return (
                          <EntryRow key={e.id}
                            iconBg={b.color + "22"} iconEl={<span style={{ color: b.color }}>◆</span>}
                            name={<span className="flex items-center gap-1.5">{e.name} <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: b.color + "28", color: b.color }}>{b.label}</span>{e.historical && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-dim text-muted">historical</span>}</span>}
                            sub={`${fmtDate(e.date)}${e.note ? ` · ${e.note}` : ""}`}
                            amount={fmt(e.amount)} amtColor={b.color}
                            onDel={() => delInv(e.id)}
                          />
                        )
                      })}
                    </div>
                  )
              })()}
            </>
          )}

          {showForm && <div className="mt-3">
            <FormSheet title="Log a buy" onSubmit={addInvestment} label="Log buy">
              <label className={lbl}>Asset / fund name</label>
              <input className={inp} value={form.invName} onChange={e => upd("invName", e.target.value)} placeholder="Nubank, Fintual, S&P500…" />
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Amount (MXN)</label><input className={inp} type="number" value={form.invAmt} onChange={e => upd("invAmt", e.target.value)} placeholder="0.00" /></div>
                <div><label className={lbl}>Date</label><input className={inp} type="date" value={form.invDate} onChange={e => upd("invDate", e.target.value)} /></div>
              </div>
              <label className={lbl}>Type</label>
              <Toggle value={form.invType} onChange={v => upd("invType", v)} options={[{ value: "fund", label: "Fund" }, { value: "stock", label: "Stock" }]} />
              <label className={lbl}>Account</label>
              <Toggle value={form.invGf ? "gf" : "me"} onChange={v => upd("invGf", v === "gf")} options={[{ value: "me", label: "Mine" }, { value: "gf", label: "GF" }]} />
              <label className={lbl}>Note (optional)</label>
              <input className={inp} value={form.invNote} onChange={e => upd("invNote", e.target.value)} placeholder="Optional" />
            </FormSheet>
          </div>}
          <FAB label={showForm ? "✕ Close" : "+ Log buy"} onClick={() => setShowForm(v => !v)} color="bg-blue" />
        </div>
      )}

      {/* ── SETTINGS ── */}
      {tab === "Settings" && (
        <div className="p-3.5">
          <Card>
            <SectionLabel>Monthly budgets</SectionLabel>
            {state.budgets.length === 0
              ? <div className="text-xs text-dim mb-3">No budgets set</div>
              : state.budgets.map(b => (
                <div key={b.cat} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[b.cat] ?? "#888" }} />
                    <span className="text-sm">{b.cat}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{fmt(b.limitMXN)}</span>
                    <button onClick={() => delBudget(b.cat)} className="text-dim text-base">×</button>
                  </div>
                </div>
              ))
            }
            <div className="mt-3 pt-3 border-t border-border">
              <label className={lbl}>Category</label>
              <select className={inp} value={form.budgetCat} onChange={e => upd("budgetCat", e.target.value)}>{CATS.map(c => <option key={c}>{c}</option>)}</select>
              <label className={lbl}>Monthly limit (MXN)</label>
              <input className={inp} type="number" value={form.budgetLimit} onChange={e => upd("budgetLimit", e.target.value)} placeholder="0.00" />
              <button onClick={saveBudget} className="w-full py-3 text-sm font-semibold rounded-xl bg-green text-bg">Set budget</button>
            </div>
          </Card>

          <Card>
            <SectionLabel>Export</SectionLabel>
            <a href="/api/export" download className="block w-full py-3 text-sm font-semibold rounded-xl bg-surface border border-border text-center text-text">⬇ Download CSV</a>
          </Card>

          <Card>
            <SectionLabel>Exchange rate</SectionLabel>
            <div className="text-sm">1 USD = <span className="font-semibold text-green">${state.fxRate.toFixed(2)} MXN</span></div>
            <div className="text-xs text-muted mt-1">Auto-refreshes hourly via open.er-api.com</div>
          </Card>
        </div>
      )}
    </div>
  )
}
