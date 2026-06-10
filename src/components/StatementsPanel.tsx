"use client"
import { useState } from "react"
import { C, CC_CARDS, fmt, fmtDate } from "@/lib/utils"
import { Card, Label, inp, lbl, ToggleRow } from "./ui"
import { Icon } from "./Icon"
import type { Statement } from "@/types"

interface Props {
  statements: Statement[]
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

function todayStr() { return new Date().toISOString().split("T")[0] }
function thisPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function StatementsPanel({ statements, reload }: Props) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    card: "OpenBank" as (typeof CC_CARDS)[number],
    period: thisPeriod(),
    closingBalance: "",
    paid: "",
    dueOn: "",
    notes: "",
  })
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payForm, setPayForm] = useState({ amount: "", paidOn: todayStr(), note: "" })

  const submitAdd = async () => {
    if (!form.closingBalance) return
    await api("/api/statements", "POST", {
      card: form.card, period: form.period,
      closingBalance: parseFloat(form.closingBalance),
      paid: parseFloat(form.paid || "0"),
      dueOn: form.dueOn || undefined,
      notes: form.notes || undefined,
    })
    setForm({ ...form, closingBalance: "", paid: "", dueOn: "", notes: "" })
    setAdding(false)
    await reload()
  }
  const submitPay = async (id: string) => {
    if (!payForm.amount) return
    await api("/api/statements", "PATCH", {
      id, amount: parseFloat(payForm.amount),
      paidOn: payForm.paidOn, note: payForm.note || undefined,
    })
    setPayingId(null)
    setPayForm({ amount: "", paidOn: todayStr(), note: "" })
    await reload()
  }
  const removeStatement = async (id: string) => {
    if (!confirm("Remove this statement?\n\nAssociated payment expenses are NOT removed.")) return
    await api("/api/statements", "DELETE", { id })
    await reload()
  }

  // Sort: oldest unpaid first, then newest paid-off
  const sorted = [...statements].sort((a, b) => {
    const aOpen = a.paid < a.closingBalance
    const bOpen = b.paid < b.closingBalance
    if (aOpen !== bOpen) return aOpen ? -1 : 1
    return b.period.localeCompare(a.period)
  })

  return (
    <Card style={{ padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Label style={{ marginBottom: 0 }}>Statements</Label>
        <button onClick={() => setAdding(v => !v)} style={{
          padding: "6px 12px", fontSize: 11.5, fontWeight: 700, border: "none", borderRadius: 10,
          cursor: "pointer", background: adding ? C.surface : C.amber, color: adding ? C.muted : "#0E0F12",
          fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5,
          ...(adding ? { border: `1px solid ${C.border}` } : {}),
        }}>
          <Icon name={adding ? "close" : "plus"} size={12} color={adding ? C.muted : "#0E0F12"} />
          {adding ? "Cancel" : "Add statement"}
        </button>
      </div>

      {adding && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <label style={lbl}>Card</label>
          <ToggleRow value={form.card} onChange={v => setForm({ ...form, card: v as (typeof CC_CARDS)[number] })}
            options={CC_CARDS.map(c => ({ value: c, label: c }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>Period (YYYY-MM)</label>
              <input style={inp} value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} placeholder="2026-05" />
            </div>
            <div>
              <label style={lbl}>Due date</label>
              <input style={inp} type="date" value={form.dueOn} onChange={e => setForm({ ...form, dueOn: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>Closing balance (MXN)</label>
              <input style={inp} type="number" min="0" step="0.01" value={form.closingBalance}
                onChange={e => setForm({ ...form, closingBalance: e.target.value })} placeholder="4500.00" />
            </div>
            <div>
              <label style={lbl}>Already paid (MXN)</label>
              <input style={inp} type="number" min="0" step="0.01" value={form.paid}
                onChange={e => setForm({ ...form, paid: e.target.value })} placeholder="0.00" />
            </div>
          </div>
          <label style={lbl}>Notes</label>
          <input style={inp} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional — e.g. 'paid in full Jun 5'" />
          <button onClick={submitAdd} style={{
            width: "100%", padding: 12, fontSize: 14, fontWeight: 700, border: "none", borderRadius: 12,
            cursor: "pointer", background: C.green, color: "#0E0F12", fontFamily: "inherit",
            opacity: !form.closingBalance ? 0.5 : 1,
          }}>Save statement</button>
          <div style={{ fontSize: 10.5, color: C.dim, marginTop: 8, lineHeight: 1.5 }}>
            For pre-app months, set <strong style={{ color: C.muted }}>closing balance</strong> to what your bank actually printed.
            Recording payments later creates real expenses so cash math stays right.
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: C.dim, padding: "12px 0" }}>
          No statements yet. Add one to track pre-app balances or month-specific payments.
        </div>
      ) : sorted.map(s => {
        const remaining = Math.max(0, s.closingBalance - s.paid)
        const fullyPaid = remaining === 0
        const pct = s.closingBalance > 0 ? Math.min(100, Math.round((s.paid / s.closingBalance) * 100)) : 0
        const accent = fullyPaid ? C.green : remaining > s.closingBalance * 0.5 ? C.amber : C.amber
        return (
          <div key={s.id} style={{ padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: C.amber }}>{s.card}</span>
                  <span style={{ fontSize: 11.5, color: C.muted }}>{s.period}</span>
                  {fullyPaid && <span style={{ fontSize: 9.5, fontWeight: 700, color: C.green, background: C.greenDim, padding: "2px 7px", borderRadius: 6 }}>PAID</span>}
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  Closing {fmt(s.closingBalance)} · paid {fmt(s.paid)}{s.dueOn ? ` · due ${fmtDate(s.dueOn)}` : ""}
                </div>
                {s.notes && <div style={{ fontSize: 10.5, color: C.dim, marginTop: 2 }}>{s.notes}</div>}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: fullyPaid ? C.green : accent, letterSpacing: "-0.4px" }}>
                  {fmt(remaining)}
                </div>
                <div style={{ fontSize: 10, color: C.dim, marginTop: 1 }}>{fullyPaid ? "settled" : "remaining"}</div>
              </div>
              <button onClick={() => removeStatement(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 4 }}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <div style={{ background: C.border, borderRadius: 20, height: 4, overflow: "hidden", marginTop: 8 }}>
              <div style={{ width: pct + "%", height: "100%", borderRadius: 20, background: fullyPaid ? C.green : accent, transition: "width .4s" }} />
            </div>

            {!fullyPaid && payingId !== s.id && (
              <button onClick={() => { setPayingId(s.id); setPayForm({ amount: String(remaining), paidOn: todayStr(), note: "" }) }}
                style={{
                  marginTop: 10, padding: "7px 14px", fontSize: 11.5, fontWeight: 700, border: "none", borderRadius: 10,
                  cursor: "pointer", background: C.green + "26", color: C.green, fontFamily: "inherit",
                  display: "inline-flex", alignItems: "center", gap: 5,
                }}>
                <Icon name="check" size={12} color={C.green} />
                Record payment
              </button>
            )}
            {payingId === s.id && (
              <div style={{ marginTop: 10, padding: 10, background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, letterSpacing: "0.04em" }}>AMOUNT (MXN)</div>
                    <input type="number" min="0" step="0.01" value={payForm.amount}
                      onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", fontSize: 14, fontFamily: "inherit", border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.text, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, letterSpacing: "0.04em" }}>DATE</div>
                    <input type="date" value={payForm.paidOn}
                      onChange={e => setPayForm({ ...payForm, paidOn: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", fontSize: 14, fontFamily: "inherit", border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.text, outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>
                <input value={payForm.note} placeholder="Note (optional)"
                  onChange={e => setPayForm({ ...payForm, note: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", fontSize: 12, fontFamily: "inherit", border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.text, outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setPayingId(null)} style={{
                    padding: "7px 12px", fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}`, borderRadius: 8,
                    cursor: "pointer", background: "transparent", color: C.muted, fontFamily: "inherit",
                  }}>Cancel</button>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => submitPay(s.id)} style={{
                    padding: "7px 14px", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 8,
                    cursor: "pointer", background: C.green, color: "#0E0F12", fontFamily: "inherit",
                  }}>Save payment</button>
                </div>
                <div style={{ fontSize: 9.5, color: C.dim, marginTop: 8 }}>
                  Saving creates a Card Payments expense for that date.
                </div>
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}
