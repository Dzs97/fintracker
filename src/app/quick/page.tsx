"use client"
import { useEffect, useRef, useState } from "react"
import { C } from "@/lib/utils"

const HINT = `Examples:
  782 ubereats openbank
  150 coffee dolarapp
  625 usd income treeline
  1500 fintual fund
  750 nubank stock gf
  3000 amex 3 msi nagaoka`

export default function Quick() {
  const [text, setText] = useState("")
  const [status, setStatus] = useState<null | { kind: "ok"; msg: string } | { kind: "err"; msg: string }>(null)
  const [busy, setBusy] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { ref.current?.focus() }, [])
  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem("ft:recent") ?? "[]")) } catch {}
  }, [])

  async function submit(payload: string) {
    if (!payload.trim()) return
    setBusy(true); setStatus(null)
    try {
      const res = await fetch("/api/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Failed")
      const e = data.entry
      setStatus({ kind: "ok", msg: `Logged: ${e.name} · $${e.amount} (${data.parsed.entry_type})` })
      setText("")
      const next = [payload, ...recent.filter(r => r !== payload)].slice(0, 8)
      setRecent(next)
      try { localStorage.setItem("ft:recent", JSON.stringify(next)) } catch {}
    } catch (err) {
      setStatus({ kind: "err", msg: err instanceof Error ? err.message : "Failed" })
    } finally {
      setBusy(false)
      ref.current?.focus()
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      padding: "24px 16px", display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>FinTracker</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.6px", marginTop: 4 }}>Quick log</div>
      </div>

      <form
        onSubmit={e => { e.preventDefault(); submit(text) }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          ref={ref}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="e.g. 782 ubereats openbank"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          style={{
            flex: 1, padding: "14px 16px", fontSize: 17,
            border: `1px solid ${C.border}`, borderRadius: 14,
            background: C.surface, color: C.text, outline: "none",
            fontFamily: "inherit",
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
          }}
        >{busy ? "…" : "Log"}</button>
      </form>

      {status && (
        <div style={{
          padding: "12px 14px", borderRadius: 12, fontSize: 13.5,
          background: status.kind === "ok" ? C.greenDim : C.redDim,
          border: `1px solid ${status.kind === "ok" ? C.green : C.red}55`,
          color: status.kind === "ok" ? C.green : C.red,
        }}>{status.msg}</div>
      )}

      <pre style={{
        margin: 0, padding: 14, fontSize: 12, lineHeight: 1.6,
        color: C.muted, background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, fontFamily: "inherit", whiteSpace: "pre-wrap",
      }}>{HINT}</pre>

      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8 }}>Recent</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recent.map(r => (
              <button key={r} onClick={() => submit(r)} style={{
                textAlign: "left", padding: "10px 12px", fontSize: 13.5,
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 10, color: C.text, cursor: "pointer", fontFamily: "inherit",
              }}>{r}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: 24, display: "flex", justifyContent: "space-between", fontSize: 12, color: C.dim }}>
        <a href="/dashboard" style={{ color: C.muted, textDecoration: "none" }}>→ Dashboard</a>
      </div>
    </div>
  )
}
