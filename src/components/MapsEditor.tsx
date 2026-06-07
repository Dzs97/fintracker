"use client"
import { useState } from "react"
import { C } from "@/lib/utils"
import { Card, Label, inp, lbl } from "./ui"
import { Icon } from "./Icon"

type SplitLeg = { name: string; weight: number; inv_type?: "fund" | "stock" }
type SplitMap = Record<string, SplitLeg[]>

interface Props {
  tickers: Record<string, string>
  setTickers: React.Dispatch<React.SetStateAction<Record<string, string>>>
  funds: Record<string, string>
  setFunds: React.Dispatch<React.SetStateAction<Record<string, string>>>
  splits: SplitMap
  setSplits: React.Dispatch<React.SetStateAction<SplitMap>>
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

export function MapsEditor({ tickers, setTickers, funds, setFunds, splits, setSplits, reload }: Props) {
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

  return (
    <div style={{ marginTop: 12 }}>
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
