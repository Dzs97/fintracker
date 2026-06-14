"use client"
import { useState } from "react"
import { C, G, fmt, fmtDate, buzz } from "@/lib/utils"
import { computeCycle, fmtDueLabel, type CardConfig } from "@/lib/cardCycles"
import type { Statement } from "@/types"

/* ── Network marks (CSS, no external logos) ──────────────────────── */
function MastercardMark({ size = 30 }: { size?: number }) {
  const d = size * 0.64
  return (
    <div style={{ position: "relative", width: size, height: d }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: d, height: d, borderRadius: "50%", background: "#EB001B" }} />
      <div style={{ position: "absolute", right: 0, top: 0, width: d, height: d, borderRadius: "50%", background: "#F79E1B", mixBlendMode: "screen" }} />
    </div>
  )
}
function AmexMark() {
  return (
    <div style={{ background: "#016FD0", padding: "4px 6px", borderRadius: 2, display: "inline-block" }}>
      <div style={{ color: "#fff", fontSize: 6.5, fontWeight: 800, lineHeight: 1.0, letterSpacing: "0.03em", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
        AMERICAN<br />EXPRESS
      </div>
    </div>
  )
}
function Contactless({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.8 }}>
      {[6, 10, 14].map((r, i) => (
        <path key={i} d={`M${9 + i * 3.2} ${12 - r * 0.7} A ${r} ${r} 0 0 1 ${9 + i * 3.2} ${12 + r * 0.7}`} stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      ))}
    </svg>
  )
}

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
  wordmark: React.CSSProperties  // brand wordmark typography
  embossShadow: string  // raised-text effect for number/name
}
const CARD_STYLES: Record<string, CardStyle> = {
  // Openbank — matte black with the brand orange glow
  OpenBank: {
    gradient: "linear-gradient(140deg, #141416 0%, #1F1F22 50%, #2A1208 88%, #FF5A00 175%)",
    product: "Crédito · sin anualidad",
    network: "Mastercard",
    ink: "#FFFFFF", subink: "rgba(255,255,255,0.60)",
    chipBg: "rgba(0,0,0,0.30)",
    shine: "radial-gradient(circle, rgba(255,90,0,0.30) 0%, transparent 55%)",
    wordmark: { fontSize: 16, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.04em" },
    embossShadow: "0 1px 1px rgba(0,0,0,0.45)",
  },
  // Amex Aeroméxico — The Gold Card, champagne metal
  Amex: {
    gradient: "linear-gradient(135deg, #8C6D28 0%, #D9BD6E 30%, #F0DA9A 50%, #C9A24B 72%, #836321 100%)",
    product: "The Gold Card · Aeroméxico",
    network: "AMEX",
    ink: "#2A1F08", subink: "rgba(42,31,8,0.58)",
    chipBg: "rgba(255,255,255,0.28)",
    shine: "radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 55%)",
    wordmark: { fontSize: 13.5, fontWeight: 700, color: "#2A1F08", letterSpacing: "0.01em", fontStyle: "italic" },
    embossShadow: "0 1px 0 rgba(255,255,255,0.35)",
  },
  // Volaris INVEX 2.0 Platino — Volaris magenta into deep purple
  Invex: {
    gradient: "linear-gradient(135deg, #4A148C 0%, #7B1FA2 40%, #C2185B 78%, #E5007E 100%)",
    product: "INVEX 2.0 · Platino",
    network: "Mastercard",
    ink: "#FFFFFF", subink: "rgba(255,255,255,0.66)",
    chipBg: "rgba(0,0,0,0.22)",
    shine: "radial-gradient(circle, rgba(255,255,255,0.32) 0%, transparent 55%)",
    wordmark: { fontSize: 17, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.03em" },
    embossShadow: "0 1px 1px rgba(0,0,0,0.35)",
  },
}
const DEFAULT_STYLE: CardStyle = {
  gradient: G.invest, product: "", network: "", ink: "#FFFFFF",
  subink: "rgba(255,255,255,0.62)", chipBg: "rgba(0,0,0,0.25)",
  shine: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 50%)",
  wordmark: { fontSize: 15, fontWeight: 800, color: "#FFFFFF" },
  embossShadow: "0 1px 1px rgba(0,0,0,0.4)",
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
          background: "transparent", textAlign: "left", display: "block",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div style={{
          background: s.gradient, position: "relative", overflow: "hidden",
          aspectRatio: "1.586 / 1", padding: "16px 18px",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          fontFamily: "'Pretendard', system-ui, sans-serif",
        }}>
          {/* shine */}
          <div style={{ position: "absolute", top: "-55%", right: "-25%", width: "110%", height: "200%", background: s.shine, pointerEvents: "none" }} />

          {/* Top row: wordmark + contactless */}
          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ ...s.wordmark }}>{card === "Amex" ? "American Express" : card === "Invex" ? "volaris" : "openbank"}</div>
            <Contactless color={s.ink} />
          </div>

          {/* Product line + co-brand */}
          <div style={{ position: "relative", marginTop: -4 }}>
            <span style={{ fontSize: 9.5, color: s.subink, letterSpacing: "0.05em", fontWeight: 600 }}>{s.product}</span>
          </div>

          {/* Chip + embossed number */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 36, height: 27, borderRadius: 5, flexShrink: 0,
              background: "linear-gradient(135deg, #E8CF92 0%, #BC9748 45%, #E8CF92 70%, #A9863A 100%)",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)",
            }}>
              <div style={{ position: "relative", top: 9, height: 9, borderTop: "1px solid rgba(0,0,0,0.22)", borderBottom: "1px solid rgba(0,0,0,0.22)" }}>
                <div style={{ position: "absolute", left: "50%", top: -4, width: 1, height: 17, background: "rgba(0,0,0,0.22)" }} />
              </div>
            </div>
            <div style={{
              fontFamily: "'SF Mono','Courier New',monospace",
              fontSize: 16, fontWeight: 600, color: s.ink, letterSpacing: "0.06em",
              textShadow: s.embossShadow,
            }}>
              ••••&nbsp;••••&nbsp;••••&nbsp;{cardLast4}
            </div>
          </div>

          {/* Bottom row: cardholder + network */}
          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 7.5, color: s.subink, letterSpacing: "0.12em", fontWeight: 600 }}>TARJETAHABIENTE</div>
              <div style={{ fontSize: 11.5, color: s.ink, letterSpacing: "0.08em", fontWeight: 600, marginTop: 2, textShadow: s.embossShadow }}>
                DIEGO A. ZURITA
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              {s.network === "AMEX" ? <AmexMark /> : <MastercardMark size={32} />}
            </div>
          </div>
        </div>
      </button>

      {/* ── Data strip (app layer, under the card) ───────────────────────── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", cursor: "pointer", gap: 10,
          WebkitTapHighlightColor: "transparent",
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <div>
          <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
            {statement && statement.paid > 0 ? "Remaining" : "Owed"}
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: overdue ? C.red : urgent ? C.amber : C.text, letterSpacing: "-0.5px", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
            {fmt(statement ? remaining : pool)} <span style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>MXN</span>
          </div>
          {statement && statement.paid > 0 && (
            <div style={{ fontSize: 9.5, color: C.dim, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>paid {fmt(statement.paid)} of {fmt(statement.closingBalance)}</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {cycle && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: overdue ? C.red : urgent ? C.amber : C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                {overdue ? "Overdue" : "Due"} {cycle.statementDue.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
              <div style={{ fontSize: 10.5, color: C.dim, marginTop: 2 }}>{fmtDueLabel(cycle.daysUntilDue)}</div>
            </div>
          )}
          <span style={{
            fontSize: 11, color: C.dim,
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 200ms cubic-bezier(0.4,0,0.2,1)", display: "inline-block",
          }}>›</span>
        </div>
      </div>

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
