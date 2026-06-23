"use client"
import { useState } from "react"
import { C, fmt } from "@/lib/utils"
import { Icon } from "./Icon"
import type { Account, Goal, NwSnapshot } from "@/types"

interface Props {
  fxRate: number              // USD→MXN
  accounts: Account[]
  goals: Goal[]
  investmentValueMXN: number  // live value of all investments
  cardDebtMXN: number         // total owed across cards
  nwHistory?: NwSnapshot[]    // dated net-worth snapshots
  ccy?: "MXN" | "USD"         // controlled display currency (persisted by parent)
  onChangeCcy?: (c: "MXN" | "USD") => void
}

// Milestone thresholds (MXN of card debt remaining) for the debt-free goal.
const MILESTONES = [100000, 75000, 50000, 25000]

export function WorthCockpit({ fxRate, accounts, goals, investmentValueMXN, cardDebtMXN, nwHistory = [], ccy: ccyProp, onChangeCcy }: Props) {
  // Fall back to local state if the parent doesn't control the currency.
  const [ccyLocal, setCcyLocal] = useState<"MXN" | "USD">("MXN")
  const ccy = ccyProp ?? ccyLocal
  const setCcy = (c: "MXN" | "USD") => { onChangeCcy ? onChangeCcy(c) : setCcyLocal(c) }
  const [open, setOpen] = useState(false)

  const toMXN = (amt: number, c: "MXN" | "USD") => (c === "USD" ? amt * fxRate : amt)
  const disp = (mxn: number) => (ccy === "USD" ? mxn / fxRate : mxn)

  const cashMXN = accounts.reduce((s, a) => s + toMXN(a.balance, a.currency), 0)
  const assetsMXN = cashMXN + investmentValueMXN
  const netMXN = assetsMXN - cardDebtMXN
  const sym = ccy === "USD" ? "USD" : "MXN"

  // Asset split MX vs US (assets only — cash by currency + investments treated as MX).
  const mxCash = accounts.filter(a => a.currency === "MXN").reduce((s, a) => s + a.balance, 0)
  const usCashMXN = accounts.filter(a => a.currency === "USD").reduce((s, a) => s + a.balance * fxRate, 0)
  const mxAssets = mxCash + investmentValueMXN  // investments are MXN-denominated
  const usAssets = usCashMXN
  const totalAssets = mxAssets + usAssets
  const mxShare = totalAssets > 0 ? (mxAssets / totalAssets) * 100 : 100

  const byCcy = (c: "MXN" | "USD") => accounts.filter(a => a.currency === c)

  // Net-worth trend points in the selected currency.
  const nwPoints = nwHistory.map(h => (ccy === "USD" ? h.usd : h.mxn))

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Net worth hero */}
      <div style={{ position: "relative", overflow: "hidden", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 22, padding: "22px 20px" }}>
        <div style={{ position: "absolute", top: -90, right: -60, width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle, ${netMXN >= 0 ? C.green : C.red}2E, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>Net worth</span>
            {/* currency toggle */}
            <div style={{ display: "flex", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 100, padding: 2 }}>
              {(["MXN", "USD"] as const).map(c => (
                <button key={c} onClick={() => setCcy(c)} style={{
                  padding: "4px 12px", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 100, cursor: "pointer",
                  background: ccy === c ? C.cardHi : "transparent", color: ccy === c ? C.text : C.muted, fontFamily: "inherit",
                }}>{c}</button>
              ))}
            </div>
          </div>

          {/* Tap the number to expand the accounts breakdown */}
          <button onClick={() => setOpen(o => !o)} style={{
            background: "transparent", border: "none", padding: 0, cursor: "pointer",
            textAlign: "left", fontFamily: "inherit", color: "inherit", width: "100%",
            WebkitTapHighlightColor: "transparent",
          }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-1.5px", color: netMXN >= 0 ? C.green : C.red, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {netMXN < 0 ? "−" : ""}{fmt(Math.abs(disp(netMXN)))}<span style={{ fontSize: 14, fontWeight: 500, color: C.muted, marginLeft: 7 }}>{sym}</span>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, color: C.dim, paddingBottom: 4 }}>
                {open ? "less" : "breakdown"}
                <span style={{ display: "inline-flex", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .2s" }}>
                  <Icon name="chevR" size={11} color={C.dim} />
                </span>
              </span>
            </div>
          </button>

          {/* Net-worth trend line */}
          {nwPoints.length >= 2 ? (
            <div style={{ marginTop: 14 }}>
              <NwLine points={nwPoints} color={netMXN >= 0 ? C.green : C.red} />
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 9.5, color: C.dim }}>Tracking net worth daily…</div>
          )}

          {/* assets − liabilities */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <div style={{ flex: 1, background: C.card, borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Assets</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{fmt(disp(assetsMXN))}</div>
              <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>cash {fmt(disp(cashMXN))} · inv {fmt(disp(investmentValueMXN))}</div>
            </div>
            <div style={{ flex: 1, background: C.card, borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Card debt</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.red, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>−{fmt(disp(cardDebtMXN))}</div>
              <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>{accounts.length} account{accounts.length !== 1 ? "s" : ""}</div>
            </div>
          </div>

          {/* Expanded: accounts grouped by currency + MX/US split bar */}
          {open && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              {accounts.length === 0 ? (
                <div style={{ fontSize: 11.5, color: C.dim }}>No accounts yet — add them in Invest → Maps.</div>
              ) : (
                <>
                  {(["MXN", "USD"] as const).map(c => {
                    const group = byCcy(c)
                    if (group.length === 0) return null
                    const flag = c === "MXN" ? "🇲🇽" : "🇺🇸"
                    return (
                      <div key={c} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                          {flag} {c}
                        </div>
                        {group.map(a => (
                          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0" }}>
                            <span style={{ fontSize: 12.5, color: C.text }}>{a.name} <span style={{ fontSize: 9.5, color: C.dim }}>{a.kind}</span></span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>
                              {fmt(disp(toMXN(a.balance, a.currency)))} <span style={{ fontSize: 9, color: C.dim }}>{sym}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {/* MX vs US asset share */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: C.dim, marginBottom: 5 }}>
                      <span>🇲🇽 {mxShare.toFixed(0)}% assets</span>
                      <span>{(100 - mxShare).toFixed(0)}% 🇺🇸</span>
                    </div>
                    <div style={{ display: "flex", height: 6, borderRadius: 20, overflow: "hidden", background: C.border }}>
                      <div style={{ width: `${mxShare}%`, background: C.green, transition: "width .4s" }} />
                      <div style={{ width: `${100 - mxShare}%`, background: C.blue, transition: "width .4s" }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Goals */}
      {goals.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {goals.map(goal => {
            const isDebtFree = goal.kind === "debt-free"
            const tgtMXN = toMXN(goal.target, goal.currency)
            const curMXN = isDebtFree ? cardDebtMXN : toMXN(goal.current ?? 0, goal.currency)
            const pct = isDebtFree
              ? (cardDebtMXN <= 0 ? 100 : 0)
              : Math.min(100, tgtMXN > 0 ? (curMXN / tgtMXN) * 100 : 0)
            const color = isDebtFree ? C.amber : C.green
            const days = goal.targetDate ? Math.ceil((new Date(goal.targetDate + "T00:00:00").getTime() - Date.now()) / 86400000) : null
            // Milestone: highest threshold we've dropped below (or 0 if debt-free).
            const passed = isDebtFree
              ? (cardDebtMXN <= 0 ? 0 : MILESTONES.find(m => cardDebtMXN < m) ?? null)
              : null
            return (
              <div key={goal.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{goal.title}</span>
                  {isDebtFree && days != null ? (
                    <span style={{ fontSize: 11, fontWeight: 800, color: days < 0 ? C.red : C.amber, fontVariantNumeric: "tabular-nums" }}>
                      {cardDebtMXN <= 0 ? "🎉 debt-free" : days < 0 ? `${-days}d overdue` : `${days} days to debt-free`}
                    </span>
                  ) : days != null ? (
                    <span style={{ fontSize: 10.5, color: days < 0 ? C.red : C.dim }}>
                      {days < 0 ? `${-days}d ago` : `${days}d left`}
                    </span>
                  ) : null}
                </div>
                {isDebtFree ? (
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
                    Remaining: <span style={{ color: C.amber, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(disp(cardDebtMXN))} {sym}</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
                    <span style={{ color: C.green, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(disp(curMXN))}</span> of {fmt(disp(tgtMXN))} {sym} · {pct.toFixed(0)}%
                  </div>
                )}
                <div style={{ background: C.border, borderRadius: 20, height: 6, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(2, pct)}%`, height: "100%", borderRadius: 20, background: color, transition: "width .6s cubic-bezier(0.4,0,0.2,1)" }} />
                </div>
                {/* Milestone badge for the debt-free goal */}
                {isDebtFree && passed != null && (
                  <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 100, background: C.green + "1A" }}>
                    <span style={{ fontSize: 11 }}>{passed === 0 ? "🏁" : "✓"}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: C.green }}>
                      {passed === 0 ? "Cleared — debt-free!" : `Past the ${fmt(passed)} mark`}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Net-worth trend line (mirrors HomeScreen's SmallLine). */
function NwLine({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const W = 280, H = 48, pad = 4
  const xs = points.map((_, i) => pad + i * ((W - pad * 2) / (points.length - 1)))
  const ys = points.map(p => H - pad - ((p - min) / span) * (H - pad * 2))
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ")
  const area = `${path} L${xs[xs.length - 1]},${H} L${xs[0]},${H} Z`
  const gid = `nwc${color.replace(/[^a-z0-9]/gi, "")}`
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3.5} fill={C.bg} stroke={color} strokeWidth={2.5} />
    </svg>
  )
}
