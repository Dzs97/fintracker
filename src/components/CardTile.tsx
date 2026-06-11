"use client"
import { useState } from "react"
import { C, G, fmt, fmtDate, buzz } from "@/lib/utils"
import { Icon } from "./Icon"
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

/** Brand gradients — each card gets a distinct color signature. */
const CARD_GRADIENTS: Record<string, string> = {
  OpenBank: "linear-gradient(135deg, #04D77F 0%, #47CBFF 100%)",
  Amex:     "linear-gradient(135deg, #7B61FF 0%, #04D77F 100%)",
  Invex:    "linear-gradient(135deg, #FF6BAA 0%, #FF9D68 100%)",
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
  const grad = CARD_GRADIENTS[card] ?? G.invest
  const cycle = cfg ? computeCycle(cfg) : null
  const overdue = cycle ? cycle.overdue && statementBalance > 0 : false
  const urgent = cycle ? cycle.daysUntilDue <= 3 && statementBalance > 0 : false
  const cardLast4 = card === "OpenBank" ? "7191" : card === "Amex" ? "3003" : "··"
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
          background: grad, position: "relative", overflow: "hidden",
          padding: "18px 18px 16px",
        }}>
          {/* Decorative shine arc */}
          <div style={{
            position: "absolute", top: "-50%", right: "-30%",
            width: "120%", height: "200%",
            background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 50%)",
            pointerEvents: "none",
          }} />
          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 700 }}>
                {card}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4, letterSpacing: "0.1em" }}>
                •••• {cardLast4}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <Icon name="cards" size={20} color="rgba(255,255,255,0.9)" />
              <span style={{
                padding: "3px 9px", fontSize: 9.5, fontWeight: 700,
                background: "rgba(0,0,0,0.25)", color: "#FFFFFF",
                borderRadius: 100, backdropFilter: "blur(8px)",
              }}>{open ? "Close" : "Tap to open"}</span>
            </div>
          </div>
          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
                {statement && statement.paid > 0 ? "Remaining" : "Owed"}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.8px", lineHeight: 1.05, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                {/* Statement-aware face: when a statement exists, prefer its remaining
                    so partial payments visibly reduce the headline number. */}
                {fmt(statement ? remaining : pool)} <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>MXN</span>
              </div>
              {statement && statement.paid > 0 && (
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.7)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
                  paid {fmt(statement.paid)} of {fmt(statement.closingBalance)}
                </div>
              )}
            </div>
            {cycle && (
              <div style={{
                background: "rgba(0,0,0,0.25)", borderRadius: 12,
                padding: "8px 12px", textAlign: "right",
                color: "#FFFFFF", backdropFilter: "blur(8px)",
              }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
                  {overdue ? "OVERDUE" : "DUE"}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, letterSpacing: "-0.2px" }}>
                  {cycle.statementDue.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.85)", marginTop: 1 }}>
                  {fmtDueLabel(cycle.daysUntilDue)}
                </div>
              </div>
            )}
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
