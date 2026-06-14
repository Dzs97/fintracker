"use client"
import { useState } from "react"
import { C, G, fmt, fmtDate, buzz } from "@/lib/utils"
import { computeCycle, fmtDueLabel, type CardConfig } from "@/lib/cardCycles"
import type { Statement } from "@/types"

function quickPayPill(color: string, solid = false): React.CSSProperties {
  return {
    padding: "8px 12px", fontSize: 11.5, fontFamily: "inherit",
    border: solid ? "none" : `1px solid ${color}55`, borderRadius: 100,
    cursor: "pointer", background: solid ? color : color + "1A",
    color: solid ? "#0B0D11" : color,
    display: "inline-flex", alignItems: "center",
  }
}

async function recordPayment(statementId: string, amount: number) {
  const res = await fetch("/api/statements", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: statementId, amount }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/** Card face styling modeled on the real products.
 *  ink/subink/chipBg adapt for light (gold) vs dark faces so text stays legible. */
interface CardStyle {
  gradient: string
  product: string       // sub-label under the bank name
  network: string       // bottom-right network mark
  ink: string           // primary text
  subink: string        // secondary text
  chipBg: string        // translucent chip background
  shine: string         // radial shine overlay
}
const CARD_STYLES: Record<string, CardStyle> = {
  // Openbank — matte black with the brand orange glow
  OpenBank: {
    gradient: "linear-gradient(135deg, #1C1C1E 0%, #2A2A2E 55%, #FF5A00 160%)",
    product: "Openbank · sin anualidad",
    network: "Mastercard",
    ink: "#FFFFFF", subink: "rgba(255,255,255,0.62)",
    chipBg: "rgba(0,0,0,0.30)",
    shine: "radial-gradient(circle, rgba(255,90,0,0.28) 0%, transparent 55%)",
  },
  // Amex Aeroméxico — The Gold Card, champagne metal
  Amex: {
    gradient: "linear-gradient(135deg, #9C7A2E 0%, #E8CD7E 45%, #C9A24B 70%, #8A6A22 100%)",
    product: "Gold · Aeroméxico",
    network: "AMEX",
    ink: "#2A1F08", subink: "rgba(42,31,8,0.62)",
    chipBg: "rgba(255,255,255,0.28)",
    shine: "radial-gradient(circle, rgba(255,255,255,0.45) 0%, transparent 55%)",
  },
  // Volaris INVEX 2.0 Platino — Volaris magenta into deep purple
  Invex: {
    gradient: "linear-gradient(135deg, #6A1B9A 0%, #A21CAF 45%, #E5007E 100%)",
    product: "Volaris 2.0 · Platino",
    network: "Mastercard",
    ink: "#FFFFFF", subink: "rgba(255,255,255,0.66)",
    chipBg: "rgba(0,0,0,0.22)",
    shine: "radial-gradient(circle, rgba(255,255,255,0.30) 0%, transparent 55%)",
  },
}
const DEFAULT_STYLE: CardStyle = {
  gradient: G.invest, product: "", network: "", ink: "#FFFFFF",
  subink: "rgba(255,255,255,0.62)", chipBg: "rgba(0,0,0,0.25)",
  shine: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 50%)",
}

interface Props {
  card: string
  cfg: CardConfig | undefined
  pool: number               // total unsettled MXN pool for this card
  currentCycleTotal: number  // charges in the open (post-cutoff) cycle
  statementBalance: number   // unpaid balance from the closed cycle (statement.closingBalance - statement.paid)
  statement: Statement | undefined  // current statement (matching the closed cycle period)
  onSettle: () => void
  onPaymentRecorded: () => void  // triggers dashboard reload after a payment posts
}

export function CardTile({ card, cfg, pool, currentCycleTotal, statementBalance, statement, onSettle, onPaymentRecorded }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [customAmt, setCustomAmt] = useState("")
  async function payAmount(amount: number) {
    if (!statement || amount <= 0 || busy) return
    if (!confirm(`Record payment of ${fmt(amount)} MXN against ${card} ${statement.period}?\nThis creates a real expense.`)) return
    buzz(15)
    setBusy(true)
    try { await recordPayment(statement.id, amount); await onPaymentRecorded() }
    finally { setBusy(false) }
  }
  const s = CARD_STYLES[card] ?? DEFAULT_STYLE
  const cycle = cfg ? computeCycle(cfg) : null
  const overdue = cycle ? cycle.overdue && statementBalance > 0 : false
  const urgent = cycle ? cycle.daysUntilDue <= 3 && statementBalance > 0 : false
  const cardLast4 = card === "OpenBank" ? "8433" : card === "Amex" ? "3003" : card === "Invex" ? "7191" : "··"
  const remaining = statement ? Math.max(0, statement.closingBalance - statement.paid) : statementBalance

  return (
    <div style={{
      borderRadius: 22, overflow: "hidden",
      border: overdue ? `1px solid ${C.red}80` : urgent ? `1px solid ${C.amber}80` : `1px solid ${C.border}`,
      background: C.card,
      transition: "border 200ms cubic-bezier(0.4,0,0.2,1)",
    }}>
      {/* ── Physical credit-card face ─────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: 0, border: "none", cursor: "pointer",
          background: "transparent", textAlign: "left",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div style={{
          background: s.gradient, position: "relative", overflow: "hidden",
          padding: "18px 18px 16px", minHeight: 168,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}>
          {/* Decorative shine arc */}
          <div style={{
            position: "absolute", top: "-50%", right: "-30%",
            width: "120%", height: "200%",
            background: s.shine, pointerEvents: "none",
          }} />
          {/* EMV chip */}
          <div style={{
            position: "absolute", top: 56, left: 18,
            width: 34, height: 26, borderRadius: 5,
            background: "linear-gradient(135deg, #E6C988 0%, #B8923F 50%, #E6C988 100%)",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)",
          }}>
            <div style={{ position: "absolute", inset: "6px 0", borderTop: "1px solid rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(0,0,0,0.2)" }} />
          </div>

          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, color: s.ink, letterSpacing: "0.02em", fontWeight: 800 }}>
                {card}
              </div>
              <div style={{ fontSize: 9.5, color: s.subink, marginTop: 2, letterSpacing: "0.04em", fontWeight: 600 }}>
                {s.product}
              </div>
            </div>
            <span style={{
              padding: "3px 9px", fontSize: 9.5, fontWeight: 700,
              background: s.chipBg, color: s.ink,
              borderRadius: 100, backdropFilter: "blur(8px)",
            }}>{open ? "Close" : "Tap to open"}</span>
          </div>

          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 10, color: s.subink, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
                {statement && statement.paid > 0 ? "Remaining" : "Owed"}
              </div>
              <div style={{ fontSize: 27, fontWeight: 800, color: s.ink, letterSpacing: "-0.8px", lineHeight: 1.05, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                {fmt(statement ? remaining : pool)} <span style={{ fontSize: 12, fontWeight: 500, color: s.subink }}>MXN</span>
              </div>
              <div style={{ fontSize: 10.5, color: s.subink, marginTop: 5, letterSpacing: "0.14em", fontWeight: 600 }}>
                ••••&nbsp;&nbsp;{cardLast4}
              </div>
              {statement && statement.paid > 0 && (
                <div style={{ fontSize: 10, color: s.subink, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
                  paid {fmt(statement.paid)} of {fmt(statement.closingBalance)}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              {cycle && (
                <div style={{
                  background: s.chipBg, borderRadius: 12,
                  padding: "8px 12px", textAlign: "right",
                  color: s.ink, backdropFilter: "blur(8px)",
                }}>
                  <div style={{ fontSize: 9, color: s.subink, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
                    {overdue ? "OVERDUE" : "DUE"}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, letterSpacing: "-0.2px" }}>
                    {cycle.statementDue.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  <div style={{ fontSize: 9.5, color: s.subink, marginTop: 1 }}>
                    {fmtDueLabel(cycle.daysUntilDue)}
                  </div>
                </div>
              )}
              <span style={{ fontSize: 12, fontWeight: 800, color: s.ink, letterSpacing: "0.04em", fontStyle: s.network === "AMEX" ? "italic" : "normal" }}>
                {s.network}
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* ── Expanded body ────────────────────────────────────────────────── */}
      {open && (
        <div className="ft-fade-up" style={{ padding: "16px 18px 18px", background: C.card }}>
          {!cfg ? (
            <div style={{ fontSize: 12, color: C.dim, padding: "12px 0", textAlign: "center" }}>
              Configure cutoff + due day in Invest → Maps to enable statement tracking.
            </div>
          ) : (
            <>
              {/* Statement balance breakdown */}
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1, background: C.bg, borderRadius: 12, padding: "11px 12px" }}>
                  <div style={{ fontSize: 9.5, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>Statement</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: overdue ? C.red : urgent ? C.amber : C.text, marginTop: 3, letterSpacing: "-0.4px", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(remaining)}
                  </div>
                  {statement && statement.paid > 0 && (
                    <div style={{ fontSize: 9.5, color: C.dim, marginTop: 2 }}>paid {fmt(statement.paid)}</div>
                  )}
                </div>
                <div style={{ flex: 1, background: C.bg, borderRadius: 12, padding: "11px 12px" }}>
                  <div style={{ fontSize: 9.5, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>Current cycle</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginTop: 3, letterSpacing: "-0.4px", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(currentCycleTotal)}
                  </div>
                  <div style={{ fontSize: 9.5, color: C.dim, marginTop: 2 }}>
                    cuts {cycle!.nextCutoff.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </div>
              </div>

              {/* Payment area */}
              {statement && remaining > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 8 }}>Quick pay</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {statement.pagoMinimo != null && statement.pagoMinimo > 0 && (
                      <button onClick={() => payAmount(statement.pagoMinimo!)} disabled={busy} style={quickPayPill(C.muted)}>
                        Mínimo <span style={{ color: C.text, fontWeight: 700, fontVariantNumeric: "tabular-nums", marginLeft: 4 }}>{fmt(statement.pagoMinimo)}</span>
                      </button>
                    )}
                    <button onClick={() => payAmount(remaining)} disabled={busy} style={quickPayPill(C.green, true)}>
                      Sin intereses <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", marginLeft: 4 }}>{fmt(remaining)}</span>
                    </button>
                    {statement.totalOwed != null && statement.totalOwed > statement.closingBalance && (
                      <button onClick={() => payAmount(Math.max(0, statement.totalOwed! - statement.paid))} disabled={busy} style={quickPayPill(C.amber)}>
                        Saldo total <span style={{ color: C.text, fontWeight: 700, fontVariantNumeric: "tabular-nums", marginLeft: 4 }}>{fmt(Math.max(0, statement.totalOwed - statement.paid))}</span>
                      </button>
                    )}
                  </div>

                  {/* Custom partial-payment input */}
                  <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, paddingLeft: 12 }}>
                      <span style={{ fontSize: 13, color: C.dim, fontWeight: 600, marginRight: 6 }}>$</span>
                      <input
                        type="number" inputMode="decimal" min="0" step="0.01"
                        value={customAmt}
                        onChange={e => setCustomAmt(e.target.value)}
                        placeholder="Custom partial amount"
                        style={{
                          flex: 1, minWidth: 0, padding: "11px 12px 11px 0", fontSize: 14,
                          fontFamily: "inherit", fontVariantNumeric: "tabular-nums",
                          border: "none", background: "transparent", color: C.text,
                          outline: "none",
                        }}
                      />
                    </div>
                    <button
                      onClick={async () => {
                        const v = parseFloat(customAmt)
                        if (!isFinite(v) || v <= 0) return
                        await payAmount(v)
                        setCustomAmt("")
                      }}
                      disabled={busy || !customAmt || parseFloat(customAmt) <= 0}
                      style={{
                        padding: "0 18px", fontSize: 13, fontWeight: 700,
                        border: "none", borderRadius: 12, cursor: "pointer",
                        background: !customAmt || parseFloat(customAmt) <= 0 ? C.cardHi : C.green,
                        color: !customAmt || parseFloat(customAmt) <= 0 ? C.muted : "#0B0D11",
                        fontFamily: "inherit",
                        opacity: busy ? 0.5 : 1,
                      }}
                    >Pay</button>
                  </div>
                  <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
                    Any partial works — remaining stays on this statement until paid or next cutoff rolls it.
                  </div>
                </div>
              )}

              {/* Settle all (full pool, includes any carry-over) */}
              {pool > 0 && (
                <button onClick={onSettle} style={{
                  width: "100%", padding: "11px 14px", fontSize: 12, fontFamily: "inherit", fontWeight: 700,
                  border: `1px solid ${C.border}`, borderRadius: 12, cursor: "pointer",
                  background: "transparent", color: C.muted,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  Settle full pool · {fmt(pool)}
                </button>
              )}

              {statement?.dueOn && (
                <div style={{ fontSize: 10, color: C.dim, marginTop: 10, textAlign: "center" }}>
                  Bank statement closed {fmtDate(cycle!.lastCutoff.toISOString().split("T")[0])} · due {fmtDate(statement.dueOn)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
