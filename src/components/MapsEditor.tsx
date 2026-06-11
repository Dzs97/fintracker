"use client"
import { useState } from "react"
import { C, CC_CARDS, CATS } from "@/lib/utils"
import { Card, Label, inp, lbl, ToggleRow } from "./ui"
import { Icon } from "./Icon"
import { computeCycle, type CardConfig } from "@/lib/cardCycles"
import type { Recurring, FutureObligation } from "@/types"

type SplitLeg = { name: string; weight: number; inv_type?: "fund" | "stock" }
type SplitMap = Record<string, SplitLeg[]>

interface Props {
  tickers: Record<string, string>
  setTickers: React.Dispatch<React.SetStateAction<Record<string, string>>>
  funds: Record<string, string>
  setFunds: React.Dispatch<React.SetStateAction<Record<string, string>>>
  splits: SplitMap
  setSplits: React.Dispatch<React.SetStateAction<SplitMap>>
  cardConfig: Record<string, CardConfig>
  setCardConfig: React.Dispatch<React.SetStateAction<Record<string, CardConfig>>>
  recurring: Recurring[]
  setRecurring: React.Dispatch<React.SetStateAction<Recurring[]>>
  obligations: FutureObligation[]
  setObligations: React.Dispatch<React.SetStateAction<FutureObligation[]>>
  reload: () => Promise<void>
}

async function api<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function MapsEditor({
  tickers, setTickers, funds, setFunds, splits, setSplits,
  cardConfig, setCardConfig, recurring, setRecurring,
  obligations, setObligations, reload,
}: Props) {
  const [newTickerName, setNewTickerName] = useState("")
  const [newTickerSym, setNewTickerSym] = useState("")
  const [newFundName, setNewFundName] = useState("")
  const [newFundFund, setNewFundFund] = useState("")
  const [newSplitName, setNewSplitName] = useState("")
  const [newSplitLegs, setNewSplitLegs] = useState<SplitLeg[]>([
    { name: "", weight: 0.5, inv_type: "fund" },
    { name: "", weight: 0.5, inv_type: "fund" },
  ])

  // ── Tickers ──
  const addTicker = async () => {
    if (!newTickerName || !newTickerSym) return
    const out = await api<{ tickers: Record<string, string> }>("/api/prices", "PUT", { name: newTickerName, ticker: newTickerSym })
    setTickers(out.tickers)
    setNewTickerName(""); setNewTickerSym("")
  }
  const removeTicker = async (name: string) => {
    if (!confirm(`Remove ticker mapping for ${name}?`)) return
    const out = await api<{ tickers: Record<string, string> }>("/api/prices", "PUT", { name, ticker: "" })
    setTickers(out.tickers)
  }

  // ── Funds ──
  const addFund = async () => {
    if (!newFundName || !newFundFund) return
    const out = await api<{ funds: Record<string, string> }>("/api/funds", "PUT", { name: newFundName, fund: newFundFund })
    setFunds(out.funds)
    setNewFundName(""); setNewFundFund("")
  }
  const removeFund = async (name: string) => {
    if (!confirm(`Remove fund mapping for ${name}?`)) return
    const out = await api<{ funds: Record<string, string> }>("/api/funds", "PUT", { name, fund: "" })
    setFunds(out.funds)
  }

  // ── Splits ──
  const saveSplit = async (name: string, legs: SplitLeg[]) => {
    const cleaned = legs.filter(l => l.name && l.weight > 0)
    const sum = cleaned.reduce((s, l) => s + l.weight, 0)
    if (sum <= 0 || sum > 1.0001) {
      alert(`Weights must sum to <= 1.0 (got ${sum.toFixed(3)})`)
      return
    }
    const out = await api<{ splits: SplitMap }>("/api/splits", "PUT", { name, legs: cleaned })
    setSplits(out.splits)
  }
  const removeSplit = async (name: string) => {
    if (!confirm(`Remove split rule for ${name}? (Existing entries are unaffected.)`)) return
    const out = await api<{ splits: SplitMap }>("/api/splits", "PUT", { name, legs: [] })
    setSplits(out.splits)
  }
  const migrateSplit = async (name: string) => {
    if (!confirm(`Apply '${name}' split rule to all existing investments named '${name}'?\n\nThey will be replaced with split legs.`)) return
    await api<{ migrated: number }>(`/api/splits?name=${encodeURIComponent(name)}`, "POST")
    await reload()
  }
  const addNewSplit = async () => {
    if (!newSplitName) return
    await saveSplit(newSplitName, newSplitLegs)
    setNewSplitName("")
    setNewSplitLegs([
      { name: "", weight: 0.5, inv_type: "fund" },
      { name: "", weight: 0.5, inv_type: "fund" },
    ])
  }

  const smallInp: React.CSSProperties = {
    padding: "9px 11px", fontSize: 13, fontFamily: "inherit",
    border: `1px solid ${C.border}`, borderRadius: 10, background: C.bg,
    color: C.text, outline: "none", boxSizing: "border-box",
  }

  // ── Card cycles ──
  const setCardCycle = async (card: string, cutoffDay: number, dueDay: number) => {
    const out = await api<{ config: Record<string, CardConfig> }>("/api/cards/config", "PUT", { card, cutoffDay, dueDay })
    setCardConfig(out.config)
  }
  const clearCardCycle = async (card: string) => {
    if (!confirm(`Remove cycle config for ${card}?`)) return
    const out = await api<{ config: Record<string, CardConfig> }>("/api/cards/config", "PUT", { card, cutoffDay: null, dueDay: null })
    setCardConfig(out.config)
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* ── Card cycles ── */}
      <Card style={{ padding: 16, marginBottom: 12 }}>
        <Label>Card statement cycles</Label>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 12 }}>
          Set the day-of-month each card cuts and the day payment is due. If due day &lt; cutoff day, due falls in the following month.
        </div>
        {CC_CARDS.map(card => (
          <CardCycleRow key={card} card={card}
            cfg={cardConfig[card]}
            onSave={(c, d) => setCardCycle(card, c, d)}
            onClear={() => clearCardCycle(card)}
          />
        ))}
      </Card>

      {/* ── Tickers ── */}
      <Card style={{ padding: 16, marginBottom: 12 }}>
        <Label>Stock tickers (Yahoo)</Label>
        {Object.keys(tickers).length === 0 ? (
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 12 }}>No tickers mapped yet</div>
        ) : (
          Object.entries(tickers).map(([name, sym]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, fontSize: 13.5 }}>{name}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.blue, fontFamily: "monospace" }}>{sym}</div>
              <button onClick={() => removeTicker(name)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 4 }}>
                <Icon name="close" size={15} />
              </button>
            </div>
          ))
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          <input value={newTickerName} onChange={e => setNewTickerName(e.target.value)} placeholder="Asset name (e.g. Nubank)" style={{ ...smallInp, flex: 2 }} />
          <input value={newTickerSym} onChange={e => setNewTickerSym(e.target.value.toUpperCase())} placeholder="NU" style={{ ...smallInp, flex: 1, textTransform: "uppercase" }} />
          <button onClick={addTicker} disabled={!newTickerName || !newTickerSym} style={{
            padding: "0 14px", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 10,
            cursor: "pointer", background: C.blue, color: "#0E0F12", fontFamily: "inherit",
            opacity: (!newTickerName || !newTickerSym) ? 0.4 : 1,
          }}>Add</button>
        </div>
      </Card>

      {/* ── Funds ── */}
      <Card style={{ padding: 16, marginBottom: 12 }}>
        <Label>Fintual fund mappings</Label>
        {Object.keys(funds).length === 0 ? (
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 12 }}>No funds mapped yet</div>
        ) : (
          Object.entries(funds).map(([name, fund]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, fontSize: 13.5 }}>{name}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.purple }}>{fund}</div>
              <button onClick={() => removeFund(name)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 4 }}>
                <Icon name="close" size={15} />
              </button>
            </div>
          ))
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          <input value={newFundName} onChange={e => setNewFundName(e.target.value)} placeholder="Asset name (e.g. Risky Hayek)" style={{ ...smallInp, flex: 2 }} />
          <input value={newFundFund} onChange={e => setNewFundFund(e.target.value)} placeholder="Fintual fund name" style={{ ...smallInp, flex: 2 }} />
          <button onClick={addFund} disabled={!newFundName || !newFundFund} style={{
            padding: "0 14px", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 10,
            cursor: "pointer", background: C.purple, color: "#0E0F12", fontFamily: "inherit",
            opacity: (!newFundName || !newFundFund) ? 0.4 : 1,
          }}>Add</button>
        </div>
        <div style={{ fontSize: 10.5, color: C.dim, marginTop: 8 }}>
          Tip: usually <span style={{ color: C.muted }}>name == fund</span> (e.g. both &quot;Risky Hayek&quot;).
        </div>
      </Card>

      {/* ── Splits ── */}
      <Card style={{ padding: 16, marginBottom: 12 }}>
        <Label>Auto-split rules</Label>
        {Object.keys(splits).length === 0 ? (
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 12 }}>No split rules</div>
        ) : (
          Object.entries(splits).map(([name, legs], idx) => (
            <SplitRow key={name + idx} name={name} legs={legs}
              onSave={(newLegs) => saveSplit(name, newLegs)}
              onRemove={() => removeSplit(name)}
              onMigrate={() => migrateSplit(name)}
            />
          ))
        )}
        {/* Add new */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <label style={lbl}>New rule</label>
          <input value={newSplitName} onChange={e => setNewSplitName(e.target.value)} placeholder="Source name (e.g. Fintual)" style={{ ...inp, marginBottom: 8 }} />
          {newSplitLegs.map((leg, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input value={leg.name} onChange={e => setNewSplitLegs(L => L.map((l, j) => j === i ? { ...l, name: e.target.value } : l))} placeholder="Leg name" style={{ ...smallInp, flex: 2 }} />
              <input type="number" step="0.01" min="0" max="1" value={leg.weight}
                onChange={e => setNewSplitLegs(L => L.map((l, j) => j === i ? { ...l, weight: parseFloat(e.target.value) || 0 } : l))}
                style={{ ...smallInp, width: 72 }} />
              <select value={leg.inv_type ?? "fund"} onChange={e => setNewSplitLegs(L => L.map((l, j) => j === i ? { ...l, inv_type: e.target.value as "fund" | "stock" } : l))}
                style={{ ...smallInp, width: 78 }}>
                <option value="fund">fund</option>
                <option value="stock">stock</option>
              </select>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setNewSplitLegs(L => [...L, { name: "", weight: 0, inv_type: "fund" }])} style={{
              padding: "8px 12px", fontSize: 11.5, fontWeight: 600, border: `1px solid ${C.border}`, borderRadius: 10,
              cursor: "pointer", background: "transparent", color: C.muted, fontFamily: "inherit",
            }}>+ Leg</button>
            <button onClick={addNewSplit} disabled={!newSplitName} style={{
              padding: "8px 14px", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 10,
              cursor: "pointer", background: C.green, color: "#0E0F12", fontFamily: "inherit", marginLeft: "auto",
              opacity: !newSplitName ? 0.4 : 1,
            }}>Save rule</button>
          </div>
          <div style={{ fontSize: 10.5, color: C.dim, marginTop: 8 }}>
            Weights must sum to ≤ 1.0 (rounding remainder goes to the last leg).
          </div>
        </div>
      </Card>

      {/* ── FX rate config ── */}
      <FxConfigSection reload={reload} smallInp={smallInp} />

      {/* ── Recurring entries ── */}
      <RecurringSection recurring={recurring} setRecurring={setRecurring} reload={reload} smallInp={smallInp} />

      {/* ── Future MSI obligations ── */}
      <ObligationsSection obligations={obligations} setObligations={setObligations} reload={reload} smallInp={smallInp} />
    </div>
  )
}

/* ── Recurring section ─────────────────────────────────────────────── */
function RecurringSection({ recurring, setRecurring, reload, smallInp }: {
  recurring: Recurring[]
  setRecurring: React.Dispatch<React.SetStateAction<Recurring[]>>
  reload: () => Promise<void>
  smallInp: React.CSSProperties
}) {
  const [adding, setAdding] = useState(false)
  const blank = {
    name: "", type: "expense" as Recurring["type"],
    amount: "", cat: "Other", card: "OpenBank",
    dayOfMonth: "1",
  }
  const [form, setForm] = useState(blank)

  const upsert = async (r: Partial<Recurring> & { id?: string }) => {
    const out = await api<{ entry: Recurring }>("/api/recurring", "POST", r)
    setRecurring(list => {
      const idx = list.findIndex(x => x.id === out.entry.id)
      return idx === -1 ? [...list, out.entry] : list.map(x => x.id === out.entry.id ? out.entry : x)
    })
  }
  const remove = async (id: string) => {
    if (!confirm("Remove this recurring entry?")) return
    await api("/api/recurring", "DELETE", { id })
    setRecurring(list => list.filter(r => r.id !== id))
  }
  const toggle = async (r: Recurring) => upsert({ ...r, active: !r.active })

  const submitAdd = async () => {
    if (!form.name || !form.amount) return
    await upsert({
      name: form.name, type: form.type, amount: parseFloat(form.amount),
      cat: form.type === "expense" || form.type === "cc" ? form.cat as Recurring["cat"] : undefined,
      card: form.type === "cc" ? form.card : undefined,
      dayOfMonth: parseInt(form.dayOfMonth) || 1,
      active: true,
    })
    setForm(blank); setAdding(false); await reload()
  }

  return (
    <Card style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Label style={{ marginBottom: 0 }}>Recurring entries</Label>
        <button onClick={() => setAdding(v => !v)} style={{
          padding: "5px 10px", fontSize: 10.5, fontWeight: 700, border: "none", borderRadius: 8,
          cursor: "pointer", background: adding ? C.surface : C.green, color: adding ? C.muted : "#0E0F12",
          fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4,
          ...(adding ? { border: `1px solid ${C.border}` } : {}),
        }}>
          <Icon name={adding ? "close" : "plus"} size={11} color={adding ? C.muted : "#0E0F12"} />
          {adding ? "Cancel" : "Add"}
        </button>
      </div>
      {recurring.length === 0 && !adding && (
        <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 8 }}>
          No recurring entries. Add Netflix, Telmex, gym, salary, etc. — they'll auto-fire on their day each month.
        </div>
      )}
      {recurring.map(r => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: r.active ? C.text : C.dim }}>
              {r.name}
              {!r.active && <span style={{ fontSize: 9, color: C.dim, marginLeft: 6 }}>paused</span>}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {r.type} · ${r.amount} · day {r.dayOfMonth}{r.cat ? ` · ${r.cat}` : ""}{r.card ? ` · ${r.card}` : ""}
              {r.lastFired ? ` · fired ${r.lastFired}` : ""}
            </div>
          </div>
          <button onClick={() => toggle(r)} style={{
            padding: "4px 10px", fontSize: 10.5, fontWeight: 700, border: `1px solid ${C.border}`, borderRadius: 8,
            cursor: "pointer", background: "transparent", color: r.active ? C.muted : C.green, fontFamily: "inherit",
          }}>{r.active ? "Pause" : "Resume"}</button>
          <button onClick={() => remove(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 4 }}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
      {adding && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <label style={lbl}>Name</label>
          <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Netflix, salary, Telmex…" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={lbl}>Type</label>
              <select style={{ ...smallInp, width: "100%" }} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Recurring["type"] })}>
                <option value="expense">expense</option>
                <option value="income">income</option>
                <option value="cc">CC charge</option>
                <option value="investment">investment</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Amount</label>
              <input style={{ ...smallInp, width: "100%" }} type="number" min="0" step="0.01" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label style={lbl}>Day of month</label>
              <input style={{ ...smallInp, width: "100%" }} type="number" min="1" max="31" value={form.dayOfMonth}
                onChange={e => setForm({ ...form, dayOfMonth: e.target.value })} />
            </div>
          </div>
          {(form.type === "expense" || form.type === "cc") && (
            <>
              <label style={lbl}>Category</label>
              <select style={inp} value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })}>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </>
          )}
          {form.type === "cc" && (
            <>
              <label style={lbl}>Card</label>
              <ToggleRow value={form.card as (typeof CC_CARDS)[number]} onChange={v => setForm({ ...form, card: v })} options={CC_CARDS.map(c => ({ value: c, label: c }))} />
            </>
          )}
          <button onClick={submitAdd} disabled={!form.name || !form.amount} style={{
            width: "100%", padding: 12, fontSize: 14, fontWeight: 700, border: "none", borderRadius: 12,
            cursor: "pointer", background: C.green, color: "#0E0F12", fontFamily: "inherit",
            opacity: (!form.name || !form.amount) ? 0.5 : 1,
          }}>Save recurring</button>
        </div>
      )}
    </Card>
  )
}

/* ── Future obligations section ────────────────────────────────────── */
function ObligationsSection({ obligations, setObligations, reload, smallInp }: {
  obligations: FutureObligation[]
  setObligations: React.Dispatch<React.SetStateAction<FutureObligation[]>>
  reload: () => Promise<void>
  smallInp: React.CSSProperties
}) {
  const [adding, setAdding] = useState(false)
  const blank = {
    card: "Invex" as (typeof CC_CARDS)[number],
    description: "",
    monthlyAmount: "",
    monthsRemaining: "",
  }
  const [form, setForm] = useState(blank)

  const upsert = async (o: Partial<FutureObligation> & { id?: string }) => {
    const out = await api<{ entry: FutureObligation }>("/api/obligations", "POST", o)
    setObligations(list => {
      const idx = list.findIndex(x => x.id === out.entry.id)
      return idx === -1 ? [...list, out.entry] : list.map(x => x.id === out.entry.id ? out.entry : x)
    })
  }
  const remove = async (id: string) => {
    if (!confirm("Remove this obligation?")) return
    await api("/api/obligations", "DELETE", { id })
    setObligations(list => list.filter(o => o.id !== id))
  }
  const markPaid = async (id: string) => {
    const out = await api<{ obligations: FutureObligation[] }>("/api/obligations", "PATCH", { id, dec: 1 })
    setObligations(out.obligations)
  }
  const submitAdd = async () => {
    if (!form.description || !form.monthlyAmount || !form.monthsRemaining) return
    await upsert({
      card: form.card,
      description: form.description,
      monthlyAmount: parseFloat(form.monthlyAmount),
      monthsRemaining: parseInt(form.monthsRemaining),
    })
    setForm(blank); setAdding(false); await reload()
  }

  // Group by card
  const byCard: Record<string, FutureObligation[]> = {}
  for (const o of obligations) (byCard[o.card] ??= []).push(o)

  return (
    <Card style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Label style={{ marginBottom: 0 }}>Future MSI obligations</Label>
        <button onClick={() => setAdding(v => !v)} style={{
          padding: "5px 10px", fontSize: 10.5, fontWeight: 700, border: "none", borderRadius: 8,
          cursor: "pointer", background: adding ? C.surface : C.amber, color: adding ? C.muted : "#0E0F12",
          fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4,
          ...(adding ? { border: `1px solid ${C.border}` } : {}),
        }}>
          <Icon name={adding ? "close" : "plus"} size={11} color={adding ? C.muted : "#0E0F12"} />
          {adding ? "Cancel" : "Add"}
        </button>
      </div>
      {obligations.length === 0 && !adding && (
        <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 8 }}>
          No locked-in MSI obligations. Add ongoing installment plans so you can see your debt runway 12 months out.
        </div>
      )}
      {Object.entries(byCard).map(([card, items]) => (
        <div key={card} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{card}</div>
          {items.map(o => (
            <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{o.description}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                  ${o.monthlyAmount.toFixed(2)} × {o.monthsRemaining} = ${(o.monthlyAmount * o.monthsRemaining).toFixed(2)}
                </div>
              </div>
              <button onClick={() => markPaid(o.id)} title="Decrement by 1 (when a payment hits)" style={{
                padding: "4px 10px", fontSize: 10.5, fontWeight: 700, border: "none", borderRadius: 8,
                cursor: "pointer", background: C.greenDim, color: C.green, fontFamily: "inherit",
              }}>−1 mo</button>
              <button onClick={() => remove(o.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 4 }}>
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>
      ))}
      {adding && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <label style={lbl}>Card</label>
          <ToggleRow value={form.card} onChange={v => setForm({ ...form, card: v as (typeof CC_CARDS)[number] })} options={CC_CARDS.map(c => ({ value: c, label: c }))} />
          <label style={lbl}>Description</label>
          <input style={inp} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="IKEA, Aeromexico, Casa Rodriguez…" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={lbl}>Monthly (MXN)</label>
              <input style={{ ...smallInp, width: "100%" }} type="number" min="0" step="0.01" value={form.monthlyAmount}
                onChange={e => setForm({ ...form, monthlyAmount: e.target.value })} placeholder="2807.96" />
            </div>
            <div>
              <label style={lbl}>Months left</label>
              <input style={{ ...smallInp, width: "100%" }} type="number" min="1" max="60" value={form.monthsRemaining}
                onChange={e => setForm({ ...form, monthsRemaining: e.target.value })} placeholder="4" />
            </div>
          </div>
          <button onClick={submitAdd} disabled={!form.description || !form.monthlyAmount || !form.monthsRemaining} style={{
            width: "100%", marginTop: 8, padding: 12, fontSize: 14, fontWeight: 700, border: "none", borderRadius: 12,
            cursor: "pointer", background: C.amber, color: "#0E0F12", fontFamily: "inherit",
            opacity: (!form.description || !form.monthlyAmount || !form.monthsRemaining) ? 0.5 : 1,
          }}>Save obligation</button>
        </div>
      )}
    </Card>
  )
}

/* ── FX rate configuration section ──────────────────────────────── */
function FxConfigSection({ reload, smallInp }: { reload: () => Promise<void>; smallInp: React.CSSProperties }) {
  const [cfg, setCfg] = useState<{ markupPct: string; fixedRate: string; source: string; rate?: number; baseRate?: number }>({
    markupPct: "", fixedRate: "", source: "",
  })
  // Pull current state once
  useState(() => {
    api<{ markupPct?: number; fixedRate?: number; source?: string; rate?: number; baseRate?: number }>("/api/fx", "GET")
      .then(d => setCfg({
        markupPct: d.markupPct?.toString() ?? "",
        fixedRate: d.fixedRate?.toString() ?? "",
        source:    d.source ?? "",
        rate:      d.rate,
        baseRate:  d.baseRate,
      }))
      .catch(() => {})
    return null
  })

  const save = async () => {
    const body = {
      markupPct: cfg.markupPct === "" ? null : parseFloat(cfg.markupPct),
      fixedRate: cfg.fixedRate === "" ? null : parseFloat(cfg.fixedRate),
      source:    cfg.source || null,
    }
    const out = await api<{ rate: number; baseRate: number; source: string }>("/api/fx", "PUT", body)
    setCfg({ ...cfg, rate: out.rate, baseRate: out.baseRate, source: out.source })
    await reload()
  }
  const clearOverride = async () => {
    if (!confirm("Reset to live interbank rate (no markup, no fixed override)?")) return
    setCfg({ markupPct: "", fixedRate: "", source: "" })
    const out = await api<{ rate: number; baseRate: number; source: string }>("/api/fx", "PUT", { markupPct: null, fixedRate: null, source: null })
    setCfg({ markupPct: "", fixedRate: "", source: "", rate: out.rate, baseRate: out.baseRate })
    await reload()
  }

  return (
    <Card style={{ padding: 16, marginBottom: 12 }}>
      <Label>FX rate</Label>
      <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 10, lineHeight: 1.5 }}>
        Default uses live interbank (open.er-api.com). Add a markup % to match a retail provider
        like DolarApp (~+1.15%) or pin a fixed rate. Source label shows on the Home hero.
      </div>
      {cfg.baseRate != null && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ fontSize: 9.5, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>Interbank</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{cfg.baseRate.toFixed(4)}</div>
          </div>
          <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ fontSize: 9.5, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>App uses</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{cfg.rate?.toFixed(4)}</div>
            {cfg.rate && cfg.baseRate && Math.abs(cfg.rate - cfg.baseRate) > 0.0001 && (
              <div style={{ fontSize: 9, color: C.dim, marginTop: 1 }}>
                {cfg.rate > cfg.baseRate ? "+" : ""}{(cfg.rate - cfg.baseRate).toFixed(4)} ({((cfg.rate - cfg.baseRate) / cfg.baseRate * 100).toFixed(2)}%)
              </div>
            )}
          </div>
        </div>
      )}
      <label style={lbl}>Markup % over interbank</label>
      <input style={inp} type="number" step="0.01" value={cfg.markupPct}
        onChange={e => setCfg({ ...cfg, markupPct: e.target.value })}
        placeholder="e.g. 1.15 for DolarApp" />
      <label style={lbl}>Fixed rate (overrides markup)</label>
      <input style={inp} type="number" step="0.0001" value={cfg.fixedRate}
        onChange={e => setCfg({ ...cfg, fixedRate: e.target.value })}
        placeholder="e.g. 17.65" />
      <label style={lbl}>Source label</label>
      <input style={inp} value={cfg.source}
        onChange={e => setCfg({ ...cfg, source: e.target.value })}
        placeholder="DolarApp, Banxico FIX, etc." />
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={clearOverride} style={{
          padding: "9px 14px", fontSize: 12, fontWeight: 600, border: `1px solid ${C.border}`, borderRadius: 10,
          cursor: "pointer", background: "transparent", color: C.muted, fontFamily: "inherit",
        }}>Reset</button>
        <div style={{ flex: 1 }} />
        <button onClick={save} style={{
          padding: "9px 16px", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 10,
          cursor: "pointer", background: C.green, color: "#0B0D11", fontFamily: "inherit",
        }}>Save</button>
      </div>
      <div style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>
        Tip: leave both empty → app uses pure interbank. Use just markup to track DolarApp/Wise dynamically as interbank moves.
      </div>
    </Card>
  )
}

/** Inline-editable card cycle row */
function CardCycleRow({ card, cfg, onSave, onClear }: {
  card: string; cfg: CardConfig | undefined;
  onSave: (cutoff: number, due: number) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const [cutoff, setCutoff] = useState<number>(cfg?.cutoffDay ?? 15)
  const [due,    setDue]    = useState<number>(cfg?.dueDay    ?? 5)
  const [edit, setEdit] = useState(!cfg)
  const cycle = cfg ? computeCycle(cfg) : null
  const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })

  return (
    <div style={{ paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.amber, flex: 1 }}>{card}</div>
        {!edit && cfg && (
          <>
            <button onClick={() => setEdit(true)} style={{ padding: "5px 10px", fontSize: 10.5, fontWeight: 700, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", background: "transparent", color: C.muted, fontFamily: "inherit" }}>Edit</button>
            <button onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 4 }}>
              <Icon name="close" size={15} />
            </button>
          </>
        )}
      </div>
      {!edit && cfg && cycle ? (
        <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.6 }}>
          Cuts day {cfg.cutoffDay} · due day {cfg.dueDay}{cfg.dueDay < cfg.cutoffDay ? " (next month)" : ""}<br/>
          Next cutoff <span style={{ color: C.text }}>{fmtDay(cycle.nextCutoff)}</span> · last cutoff <span style={{ color: C.text }}>{fmtDay(cycle.lastCutoff)}</span><br/>
          Statement due <span style={{ color: C.amber, fontWeight: 700 }}>{fmtDay(cycle.statementDue)}</span> ({cycle.daysUntilDue >= 0 ? `in ${cycle.daysUntilDue}d` : `${-cycle.daysUntilDue}d overdue`})
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: C.muted }}>Cuts day</span>
            <input type="number" min={1} max={31} value={cutoff}
              onChange={e => setCutoff(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
              style={{ width: 56, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg, color: C.text, outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: C.muted }}>Due day</span>
            <input type="number" min={1} max={31} value={due}
              onChange={e => setDue(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
              style={{ width: 56, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg, color: C.text, outline: "none" }}
            />
          </div>
          <div style={{ flex: 1 }} />
          {cfg && (
            <button onClick={() => { setEdit(false); setCutoff(cfg.cutoffDay); setDue(cfg.dueDay) }} style={{
              padding: "7px 12px", fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}`, borderRadius: 8,
              cursor: "pointer", background: "transparent", color: C.muted, fontFamily: "inherit",
            }}>Cancel</button>
          )}
          <button onClick={async () => { await onSave(cutoff, due); setEdit(false) }} style={{
            padding: "7px 14px", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 8,
            cursor: "pointer", background: C.green, color: "#0E0F12", fontFamily: "inherit",
          }}>Save</button>
        </div>
      )}
    </div>
  )
}

/** Inline-editable single split rule row */
function SplitRow({ name, legs, onSave, onRemove, onMigrate }: {
  name: string; legs: SplitLeg[];
  onSave: (legs: SplitLeg[]) => Promise<void>;
  onRemove: () => Promise<void>;
  onMigrate: () => Promise<void>;
}) {
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState<SplitLeg[]>(legs)
  return (
    <div style={{ paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.green, flex: 1 }}>{name}</div>
        {!edit && (
          <>
            <button onClick={() => onMigrate()} style={{ padding: "5px 10px", fontSize: 10.5, fontWeight: 700, border: "none", borderRadius: 8, cursor: "pointer", background: C.amber + "26", color: C.amber, fontFamily: "inherit" }}>Apply to past</button>
            <button onClick={() => { setDraft(legs); setEdit(true) }} style={{ padding: "5px 10px", fontSize: 10.5, fontWeight: 700, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", background: "transparent", color: C.muted, fontFamily: "inherit" }}>Edit</button>
            <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 4 }}>
              <Icon name="close" size={15} />
            </button>
          </>
        )}
      </div>
      {!edit ? (
        legs.map((l, i) => (
          <div key={i} style={{ fontSize: 12, color: C.text, marginLeft: 4, padding: "2px 0", display: "flex", justifyContent: "space-between" }}>
            <span>{l.name} <span style={{ color: C.dim }}>({l.inv_type ?? "fund"})</span></span>
            <span style={{ color: C.muted }}>{(l.weight * 100).toFixed(0)}%</span>
          </div>
        ))
      ) : (
        <>
          {draft.map((leg, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input value={leg.name} onChange={e => setDraft(d => d.map((l, j) => j === i ? { ...l, name: e.target.value } : l))}
                style={{ flex: 2, padding: "8px 10px", fontSize: 12, fontFamily: "inherit", border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg, color: C.text, outline: "none" }} />
              <input type="number" step="0.01" min="0" max="1" value={leg.weight}
                onChange={e => setDraft(d => d.map((l, j) => j === i ? { ...l, weight: parseFloat(e.target.value) || 0 } : l))}
                style={{ width: 64, padding: "8px 10px", fontSize: 12, fontFamily: "inherit", border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg, color: C.text, outline: "none" }} />
              <select value={leg.inv_type ?? "fund"} onChange={e => setDraft(d => d.map((l, j) => j === i ? { ...l, inv_type: e.target.value as "fund" | "stock" } : l))}
                style={{ width: 70, padding: "8px 8px", fontSize: 12, fontFamily: "inherit", border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg, color: C.text, outline: "none" }}>
                <option value="fund">fund</option>
                <option value="stock">stock</option>
              </select>
              <button onClick={() => setDraft(d => d.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 4 }}>
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button onClick={() => setDraft(d => [...d, { name: "", weight: 0, inv_type: "fund" }])} style={{
              padding: "6px 10px", fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}`, borderRadius: 8,
              cursor: "pointer", background: "transparent", color: C.muted, fontFamily: "inherit",
            }}>+ Leg</button>
            <div style={{ flex: 1 }} />
            <button onClick={() => setEdit(false)} style={{
              padding: "6px 12px", fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}`, borderRadius: 8,
              cursor: "pointer", background: "transparent", color: C.muted, fontFamily: "inherit",
            }}>Cancel</button>
            <button onClick={async () => { await onSave(draft); setEdit(false) }} style={{
              padding: "6px 14px", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 8,
              cursor: "pointer", background: C.green, color: "#0E0F12", fontFamily: "inherit",
            }}>Save</button>
          </div>
        </>
      )}
    </div>
  )
}
