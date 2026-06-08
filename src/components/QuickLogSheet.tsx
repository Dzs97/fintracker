"use client"
import { useEffect, useRef, useState } from "react"
import { C } from "@/lib/utils"
import { Icon } from "./Icon"

const EXAMPLES = [
  "782 ubereats openbank",
  "150 coffee dolarapp",
  "625 usd income treeline",
  "1000 fintual",
  "750 nubank stock",
]

interface Props {
  open: boolean
  onClose: () => void
  onLogged: () => void | Promise<void>
}

interface QuickResponse {
  ok: boolean
  parsed?: { entry_type: string; name: string; amount: number }
  entry?: { name: string; amount: number }
  expanded?: Array<{ name: string; amount: number }>
  error?: string
}

export function QuickLogSheet({ open, onClose, onLogged }: Props) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<null | { ok: true; msg: string } | { ok: false; msg: string }>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when the sheet opens
  useEffect(() => {
    if (!open) return
    setStatus(null); setText("")
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  async function submit(payload: string) {
    if (!payload.trim() || busy) return
    setBusy(true); setStatus(null)
    try {
      const res = await fetch("/api/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload }),
      })
      const data: QuickResponse = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed")
      const msg = data.expanded && data.expanded.length > 1
        ? `Logged ${data.expanded.length} legs: ${data.expanded.map(e => `${e.name} $${e.amount}`).join(", ")}`
        : data.entry
        ? `Logged: ${data.entry.name} · $${data.entry.amount} (${data.parsed?.entry_type})`
        : "Logged"
      setStatus({ ok: true, msg })
      setText("")
      await onLogged()
      // Auto-close after a beat so the user sees the confirmation
      setTimeout(() => { setStatus(null); onClose() }, 1100)
    } catch (e) {
      setStatus({ ok: false, msg: e instanceof Error ? e.message : "Failed" })
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
        }}
      />
      {/* Sheet */}
      <div
        role="dialog" aria-label="Quick log"
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 201,
          background: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
          border: `1px solid ${C.border}`, borderBottom: "none",
          padding: "14px 16px max(env(safe-area-inset-bottom, 16px), 16px)",
          boxShadow: "0 -16px 40px rgba(0,0,0,0.5)",
          animation: "ftSheetIn 200ms ease-out",
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 38, height: 4, borderRadius: 2, background: C.border,
          margin: "0 auto 12px",
        }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Quick log</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 4 }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); submit(text) }} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="e.g. 782 ubereats openbank"
            autoComplete="off" autoCapitalize="off" spellCheck={false}
            enterKeyHint="send"
            style={{
              flex: 1, minWidth: 0, padding: "14px 16px", fontSize: 17,
              border: `1px solid ${C.border}`, borderRadius: 14,
              background: C.bg, color: C.text, outline: "none", fontFamily: "inherit",
            }}
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            style={{
              padding: "0 18px", fontSize: 15, fontWeight: 700,
              border: "none", borderRadius: 14, cursor: "pointer",
              background: busy ? C.cardHi : C.green, color: "#0E0F12",
              fontFamily: "inherit", opacity: busy || !text.trim() ? 0.6 : 1,
              minWidth: 64,
            }}
          >{busy ? "…" : "Log"}</button>
        </form>

        {status && (
          <div style={{
            padding: "10px 12px", borderRadius: 10, fontSize: 12.5, marginBottom: 8,
            background: status.ok ? C.greenDim : C.redDim,
            border: `1px solid ${status.ok ? C.green : C.red}55`,
            color: status.ok ? C.green : C.red,
          }}>{status.msg}</div>
        )}

        {/* Tap-to-fill examples */}
        {!status && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => { setText(ex); inputRef.current?.focus() }} style={{
                padding: "6px 10px", fontSize: 11, fontFamily: "inherit",
                border: `1px solid ${C.border}`, borderRadius: 100,
                cursor: "pointer", background: C.bg, color: C.muted,
              }}>{ex}</button>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes ftSheetIn {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
