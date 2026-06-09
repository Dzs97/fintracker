"use client"
import { useEffect, useState } from "react"
import { C, CATS, CC_CARDS } from "@/lib/utils"
import { Icon } from "./Icon"
import { ToggleRow, inp, lbl } from "./ui"
import type { Expense, Income, CCCharge } from "@/types"

type Editable =
  | { kind: "expense"; row: Expense }
  | { kind: "income";  row: Income }
  | { kind: "cc";      row: CCCharge }

interface Props {
  editing: Editable | null
  onClose: () => void
  onSaved: () => void | Promise<void>
}

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function EditEntrySheet({ editing, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Seed the draft whenever we open with a new row
  useEffect(() => {
    if (!editing) { setForm(null); setErr(null); return }
    setForm({ ...editing.row })
    setErr(null)
  }, [editing])

  // Esc closes
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [editing, onClose])

  if (!editing || !form) return null

  const upd = (k: string, v: unknown) => setForm(f => ({ ...(f ?? {}), [k]: v }))

  async function save() {
    if (!editing || !form) return
    setBusy(true); setErr(null)
    try {
      if (editing.kind === "expense") {
        await api("/api/entries", "PATCH", {
          type: "expense", id: editing.row.id,
          name: form.name, amount: parseFloat(String(form.amount)),
          cat: form.cat, date: form.date, note: form.note,
        })
      } else if (editing.kind === "income") {
        await api("/api/entries", "PATCH", {
          type: "income", id: editing.row.id,
          name: form.name, amount: parseFloat(String(form.amount)),
          date: form.date, note: form.note,
        })
      } else {
        await api("/api/cc", "PATCH", {
          id: editing.row.id,
          name: form.name, amount: parseFloat(String(form.amount)),
          cat: form.cat, card: form.card, date: form.date,
          installments: Number(form.installments) || 1,
        })
      }
      await onSaved()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  const title = editing.kind === "expense" ? "Edit expense" : editing.kind === "income" ? "Edit income" : "Edit card charge"
  const accent = editing.kind === "expense" ? C.red : editing.kind === "income" ? C.green : C.amber

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
      }} />
      <div
        role="dialog" aria-label={title}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 201,
          background: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
          border: `1px solid ${C.border}`, borderBottom: "none",
          padding: "14px 16px max(env(safe-area-inset-bottom, 16px), 16px)",
          maxHeight: "92vh", overflowY: "auto",
          boxShadow: "0 -16px 40px rgba(0,0,0,0.5)",
          animation: "ftSheetIn 200ms ease-out",
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 12px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.strong, letterSpacing: "-0.3px" }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 4 }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Name */}
        <label style={lbl}>{editing.kind === "income" ? "Source" : "Description"}</label>
        <input style={inp} value={String(form.name ?? "")} onChange={e => upd("name", e.target.value)} />

        {/* Amount + Date */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>Amount ({editing.kind === "income" ? "USD" : "MXN"})</label>
            <input style={inp} type="number" min="0" step="0.01"
              value={String(form.amount ?? "")}
              onChange={e => upd("amount", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Date</label>
            <input style={inp} type="date" value={String(form.date ?? "")} onChange={e => upd("date", e.target.value)} />
          </div>
        </div>

        {/* Category (expense + cc) */}
        {(editing.kind === "expense" || editing.kind === "cc") && (
          <>
            <label style={lbl}>Category</label>
            <select style={inp} value={String(form.cat ?? "Other")} onChange={e => upd("cat", e.target.value)}>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </>
        )}

        {/* Card + Installments (cc) */}
        {editing.kind === "cc" && (
          <>
            <label style={lbl}>Card</label>
            <ToggleRow
              value={String(form.card ?? "OpenBank") as (typeof CC_CARDS)[number]}
              onChange={v => upd("card", v)}
              options={CC_CARDS.map(c => ({ value: c, label: c }))}
            />
            <label style={lbl}>Installments</label>
            <input style={inp} type="number" min="1" max="48"
              value={String(form.installments ?? 1)}
              onChange={e => upd("installments", parseInt(e.target.value) || 1)} />
          </>
        )}

        {/* Note (expense + income) */}
        {(editing.kind === "expense" || editing.kind === "income") && (
          <>
            <label style={lbl}>Note</label>
            <input style={inp} value={String(form.note ?? "")} onChange={e => upd("note", e.target.value)} />
          </>
        )}

        {err && (
          <div style={{
            padding: "10px 12px", borderRadius: 10, fontSize: 12.5, marginBottom: 8,
            background: C.redDim, border: `1px solid ${C.red}55`, color: C.red,
          }}>{err}</div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 13, fontSize: 14, fontFamily: "inherit", fontWeight: 500,
            border: `1px solid ${C.border}`, borderRadius: 14, cursor: "pointer",
            background: "transparent", color: C.muted,
          }}>Cancel</button>
          <button onClick={save} disabled={busy} style={{
            flex: 2, padding: 13, fontSize: 14, fontFamily: "inherit", fontWeight: 700,
            border: "none", borderRadius: 14, cursor: busy ? "default" : "pointer",
            background: accent, color: "#0E0F12",
            opacity: busy ? 0.6 : 1,
          }}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </>
  )
}
