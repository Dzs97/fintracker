"use client"
import { useEffect, useState } from "react"
import { C, G, CAT_COLORS, fmt } from "@/lib/utils"
import { Card, Label } from "./ui"
import { Icon } from "./Icon"
import { Donut } from "./charts"

export interface HomeSeries {
  label: string
  v: number
}

export type HomeNavTarget =
  | "expenses"
  | "income"
  | "cards"
  | "invest"
  | { kind: "category"; cat: string }

export interface HomeProps {
  moName: string
  prevMoName: string
  prevIncMXN: number
  onNavigate: (target: HomeNavTarget) => void
  fxSource?: string
  // hero
  currentCash: number
  totalIncMXN: number
  totalIncUSD: number
  totalExpMXN: number
  monthInvMXN: number
  monthCCTotal: number
  monthExpCount: number
  monthCCCount: number
  monthInvCount: number
  ccPoolTotal: number
  ccWarning: boolean
  cashDelta: number | null
  fxRate: number
  // breakdown
  catTotals: Record<string, number>
  catGrand: number
  catPrev: Record<string, number>
  // net worth
  netWorthLine: HomeSeries[]
  liveInvestmentValue: number
  investmentCost: number
  // trends
  catSeries: Record<string, number[]>
  last6Labels: string[]
}

/** Animates a number from prev → next over ~600ms. */
function useTween(target: number) {
  const [value, setValue] = useState(target)
  useEffect(() => {
    const from = value
    const to = target
    if (Math.abs(to - from) < 0.01) { setValue(to); return }
    const start = performance.now()
    const dur = 500
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(from + (to - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])
  return value
}

function AmountDisplay({ value, color, size = 48, suffix }: { value: number; color: string; size?: number; suffix?: string }) {
  const v = useTween(value)
  return (
    <div style={{
      fontSize: size, fontWeight: 800, letterSpacing: size > 32 ? "-2px" : "-1px",
      color, lineHeight: 1, fontVariantNumeric: "tabular-nums",
    }}>
      {fmt(Math.abs(v))}
      {suffix && <span style={{ fontSize: Math.round(size * 0.32), fontWeight: 500, color: C.muted, marginLeft: 7 }}>{suffix}</span>}
    </div>
  )
}

export function HomeScreen(props: HomeProps) {
  const {
    moName, prevMoName, prevIncMXN, onNavigate, fxSource, currentCash, totalIncMXN, totalIncUSD, totalExpMXN,
    monthInvMXN, monthCCTotal, monthExpCount, monthCCCount, monthInvCount,
    ccPoolTotal, ccWarning, cashDelta, fxRate,
    catTotals, catGrand, catPrev,
    netWorthLine, liveInvestmentValue, investmentCost,
    catSeries, last6Labels,
  } = props
  const investmentPL = liveInvestmentValue - investmentCost
  const savedLatest = netWorthLine[netWorthLine.length - 1]?.v ?? 0
  const netWorth = savedLatest + investmentPL
  const deltaColor = cashDelta === null ? C.muted : cashDelta >= 0 ? C.green : C.red
  const deltaLabel = cashDelta === null ? "" : (cashDelta >= 0 ? "↑" : "↓") + Math.abs(cashDelta).toFixed(0) + "%"

  return (
    <div style={{ padding: "0 14px 24px" }}>
      {/* ── Hero card ─────────────────────────────────────────── */}
      <div style={{
        position: "relative", overflow: "hidden",
        background: C.elevated, border: `1px solid ${C.border}`,
        borderRadius: 22, padding: "24px 22px 22px",
        marginBottom: 16,
      }}>
        {/* Decorative glow */}
        <div style={{
          position: "absolute", top: -80, right: -60, width: 240, height: 240,
          borderRadius: "50%",
          background: currentCash >= 0 ? `radial-gradient(circle, ${C.green}33, transparent 70%)` : `radial-gradient(circle, ${C.red}33, transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>
              {moName} balance
            </div>
            {cashDelta !== null && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: deltaColor,
                background: deltaColor + "1A", padding: "3px 10px", borderRadius: 100,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                {deltaLabel}<span style={{ fontSize: 9, color: deltaColor + "AA", marginLeft: 1 }}>vs last mo</span>
              </span>
            )}
          </div>
          <AmountDisplay value={currentCash} color={currentCash >= 0 ? C.green : C.red} size={52} suffix="MXN" />
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>
            Income − expenses − investments
          </div>

          <button
            onClick={() => onNavigate("cards")}
            style={{
              marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
              width: "100%", background: "transparent", border: "none", cursor: "pointer",
              textAlign: "left", color: "inherit",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <div>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>CC pool unpaid</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: ccWarning ? C.amber : C.text, letterSpacing: "-0.3px", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {fmt(ccPoolTotal)} <span style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>MXN</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>FX</div>
                <div style={{ fontSize: 12.5, color: C.text, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  ${fxRate.toFixed(2)} <span style={{ fontSize: 9, color: C.dim }}>· {fxSource || "live"}</span>
                </div>
              </div>
              <Icon name="chevR" size={14} color={C.dim} />
            </div>
          </button>
        </div>
      </div>

      {/* ── CC warning banner ─────────────────────────────────── */}
      {ccWarning && (
        <button
          onClick={() => onNavigate("cards")}
          style={{
            width: "100%", textAlign: "left", cursor: "pointer",
            background: `linear-gradient(135deg, ${C.amberDim} 0%, ${C.amber}1A 100%)`,
            border: `1px solid ${C.amber}55`, borderRadius: 16,
            padding: "14px 16px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 12,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: C.amber + "33",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Icon name="warning" size={18} color={C.amber} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>Card pool is high</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>Unpaid cards exceed 80% of cash</div>
          </div>
          <Icon name="chevR" size={16} color={C.amber} />
        </button>
      )}

      {/* ── Stat tiles 2×2 (tappable drill-downs) ─────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <StatTile label="Income"   value={totalIncMXN}  sub={`${fmt(totalIncUSD)} USD`} color={C.green} icon="income" gradient={G.income}   onClick={() => onNavigate("income")} />
        <StatTile label="Spent"    value={totalExpMXN}  sub={`${monthExpCount} entries`} color={C.red}  icon="expenses" gradient={G.spent}  onClick={() => onNavigate("expenses")} />
        <StatTile label="Cards"    value={monthCCTotal} sub={`${monthCCCount} charges`} color={C.amber} icon="cards"   gradient={G.cards}  onClick={() => onNavigate("cards")} />
        <StatTile label="Invested" value={monthInvMXN}  sub={`${monthInvCount} buys`}    color={C.blue}  icon="invest"  gradient={G.invest} onClick={() => onNavigate("invest")} />
      </div>

      {/* ── Month recap vs last month ─────────────────────────── */}
      {(() => {
        const prevSpent = Object.values(catPrev).reduce((s, v) => s + v, 0)
        const curSpent = catGrand
        if (prevSpent === 0 && prevIncMXN === 0) return null  // no history yet
        const spentDelta = prevSpent > 0 ? ((curSpent - prevSpent) / prevSpent) * 100 : null
        const incDelta = prevIncMXN > 0 ? ((totalIncMXN - prevIncMXN) / prevIncMXN) * 100 : null
        // Biggest absolute mover across categories
        let mover: { cat: string; diff: number } | null = null
        const cats = new Set([...Object.keys(catTotals), ...Object.keys(catPrev)])
        for (const cat of cats) {
          const diff = (catTotals[cat] ?? 0) - (catPrev[cat] ?? 0)
          if (!mover || Math.abs(diff) > Math.abs(mover.diff)) mover = { cat, diff }
        }
        const Row = ({ label, value, delta, invert }: { label: string; value: string; delta: number | null; invert?: boolean }) => {
          const good = delta === null ? null : invert ? delta <= 0 : delta >= 0
          const color = delta === null ? C.dim : good ? C.green : C.red
          return (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
              <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{value}</span>
                {delta !== null && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color, background: color + "1A", padding: "2px 8px", borderRadius: 100 }}>
                    {delta >= 0 ? "↑" : "↓"}{Math.abs(delta).toFixed(0)}%
                  </span>
                )}
              </span>
            </div>
          )
        }
        return (
          <Card style={{ padding: 18, marginBottom: 16, background: G.card }}>
            <Label>{moName} vs {prevMoName}</Label>
            <Row label="Spent (incl. cards)" value={fmt(curSpent)} delta={spentDelta} invert />
            <div style={{ borderTop: `1px solid ${C.border}` }} />
            <Row label="Income" value={fmt(totalIncMXN)} delta={incDelta} />
            {mover && Math.abs(mover.diff) > 0 && (
              <>
                <div style={{ borderTop: `1px solid ${C.border}` }} />
                <button
                  onClick={() => onNavigate({ kind: "category", cat: mover!.cat })}
                  style={{
                    width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "7px 0", background: "transparent", border: "none", cursor: "pointer",
                    fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span style={{ fontSize: 12, color: C.muted, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    Biggest mover
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: CAT_COLORS[mover.cat] ?? C.muted }} />
                    <span style={{ color: C.text, fontWeight: 600 }}>{mover.cat}</span>
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: mover.diff > 0 ? C.red : C.green, fontVariantNumeric: "tabular-nums" }}>
                    {mover.diff > 0 ? "+" : "−"}{fmt(Math.abs(mover.diff))}
                  </span>
                </button>
              </>
            )}
          </Card>
        )
      })()}

      {/* ── Net worth card (tappable → Invest) ────────────────── */}
      <button
        onClick={() => onNavigate("invest")}
        style={{
          width: "100%", textAlign: "left", cursor: "pointer",
          padding: 18, marginBottom: 16,
          background: G.card, border: `1px solid ${C.border}`, borderRadius: 16,
          fontFamily: "inherit", color: "inherit",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 }}>
          <Label style={{ marginBottom: 0 }}>Net worth</Label>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: C.dim }}>6 mo<Icon name="chevR" size={11} color={C.dim} /></div>
        </div>
        <AmountDisplay value={netWorth} color={netWorth >= 0 ? C.green : C.red} size={28} suffix="MXN" />
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
          saved <span style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{fmt(savedLatest)}</span>
          <span style={{ color: investmentPL >= 0 ? C.green : C.red, marginLeft: 6 }}>
            {investmentPL >= 0 ? "+" : ""}{fmt(investmentPL)} P&L
          </span>
        </div>
        <div style={{ marginTop: 14 }}>
          <SmallLine points={netWorthLine} color={C.green} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {netWorthLine.map(p => <span key={p.label} style={{ fontSize: 9, color: C.dim }}>{p.label}</span>)}
          </div>
        </div>
      </button>

      {/* ── Spending breakdown ────────────────────────────────── */}
      {Object.keys(catTotals).length > 0 && (
        <Card style={{ padding: 18, marginBottom: 16, background: G.card }}>
          <Label>Spending</Label>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <Donut data={Object.entries(catTotals).map(([k, v]) => ({ label: k, v, color: CAT_COLORS[k] ?? C.muted }))} size={120} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
              {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, amt]) => {
                const pct = Math.round(amt / catGrand * 100)
                const prev = catPrev[cat] ?? 0
                const delta = prev === 0 ? null : ((amt - prev) / prev) * 100
                const dColor = delta === null ? C.dim : delta >= 0 ? C.red : C.green
                return (
                  <button
                    key={cat}
                    onClick={() => onNavigate({ kind: "category", cat })}
                    style={{
                      background: "transparent", border: "none", padding: 0,
                      cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11.5, color: C.text, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: CAT_COLORS[cat] ?? C.muted, flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat}</span>
                      </span>
                      <span style={{ fontSize: 11.5, color: C.muted, flexShrink: 0, marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {delta !== null && (
                          <span style={{ fontSize: 9.5, color: dColor, fontWeight: 700 }}>
                            {delta >= 0 ? "↑" : "↓"}{Math.abs(delta).toFixed(0)}%
                          </span>
                        )}
                        <span>{pct}%</span>
                      </span>
                    </div>
                    <div style={{ background: C.border, borderRadius: 20, height: 4, overflow: "hidden" }}>
                      <div style={{ width: pct + "%", height: "100%", borderRadius: 20, background: CAT_COLORS[cat] ?? C.muted, transition: "width .6s cubic-bezier(0.4,0,0.2,1)" }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* ── 6-month trends per category ───────────────────────── */}
      {Object.keys(catTotals).length > 0 && (
        <Card style={{ padding: 18, marginBottom: 16, background: G.card }}>
          <Label>Trends · last 6 mo</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat]) => {
              const series = catSeries[cat] ?? Array(6).fill(0)
              const max = Math.max(...series, 1)
              return (
                <button
                  key={cat}
                  onClick={() => onNavigate({ kind: "category", cat })}
                  style={{
                    background: "transparent", border: "none", padding: 0,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                    fontFamily: "inherit", color: "inherit", textAlign: "left",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span style={{ fontSize: 12, color: C.text, display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, width: 110 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: CAT_COLORS[cat] ?? C.muted }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat}</span>
                  </span>
                  <svg viewBox="0 0 120 28" style={{ flex: 1, height: 28, display: "block" }}>
                    {series.map((v, i) => {
                      const bw = 14, gap = 4
                      const x = i * (bw + gap)
                      const h = Math.max(2, (v / max) * 24)
                      return <rect key={i} x={x} y={28 - h} width={bw} height={h} rx={3} fill={CAT_COLORS[cat] ?? C.muted} opacity={i === series.length - 1 ? 1 : 0.55} />
                    })}
                  </svg>
                  <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, fontVariantNumeric: "tabular-nums", width: 64, textAlign: "right" }}>{fmt(series[series.length - 1])}</span>
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 9, color: C.dim, marginTop: 10, display: "flex", justifyContent: "space-between", marginLeft: 120, marginRight: 64 }}>
            {last6Labels.map(p => <span key={p}>{p}</span>)}
          </div>
        </Card>
      )}
    </div>
  )
}

function StatTile({ label, value, sub, color, icon, gradient, onClick }: { label: string; value: number; sub: string; color: string; icon: string; gradient: string; onClick?: () => void }) {
  const v = useTween(value)
  const [pressed, setPressed] = useState(false)
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 18, padding: "14px 14px 16px", position: "relative", overflow: "hidden",
        cursor: onClick ? "pointer" : "default", textAlign: "left",
        transform: pressed ? "scale(0.97)" : "scale(1)",
        transition: "transform 150ms cubic-bezier(0.4,0,0.2,1)",
        WebkitTapHighlightColor: "transparent",
        fontFamily: "inherit", color: "inherit",
      }}>
      {/* Subtle gradient accent corner */}
      <div style={{
        position: "absolute", top: -28, right: -28, width: 80, height: 80, borderRadius: "50%",
        background: gradient, opacity: 0.10, pointerEvents: "none",
      }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, position: "relative" }}>
        <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</div>
        <div style={{ width: 22, height: 22, borderRadius: 7, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={12} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, color, letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums", position: "relative" }}>{fmt(v)}</div>
      <div style={{ fontSize: 10.5, color: C.dim, marginTop: 3, position: "relative" }}>{sub}</div>
    </button>
  )
}

function SmallLine({ points, color }: { points: HomeSeries[]; color: string }) {
  if (points.length < 2) return null
  const max = Math.max(...points.map(p => p.v), 1)
  const W = 280, H = 64, pad = 4
  const xs = points.map((_, i) => pad + i * ((W - pad * 2) / (points.length - 1)))
  const ys = points.map(p => H - pad - (p.v / max) * (H - pad * 2))
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ")
  const area = `${path} L${xs[xs.length - 1]},${H} L${xs[0]},${H} Z`
  const gid = `nwlg${color.replace(/[^a-z0-9]/gi, "")}`
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={4} fill={C.bg} stroke={color} strokeWidth={2.5} />
    </svg>
  )
}
