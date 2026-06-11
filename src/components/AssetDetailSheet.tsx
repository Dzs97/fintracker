"use client"
import { useEffect, useState } from "react"
import { C, fmt, fmtDate } from "@/lib/utils"
import { Icon } from "./Icon"
import { Tag } from "./ui"
import { Shimmer } from "./Skeleton"
import type { Investment } from "@/types"

export interface AssetSelection {
  name: string
  gf: boolean
  type: "fund" | "stock"
}

interface Props {
  asset: AssetSelection | null
  buys: Investment[]            // this asset+owner's buys
  currentPrice: number          // latest known price (USD for stocks, MXN NAV for funds)
  fxRate: number
  onClose: () => void
}

interface HistoryPoint { date: string; price: number }

export function AssetDetailSheet({ asset, buys, currentPrice, fxRate, onClose }: Props) {
  const [series, setSeries] = useState<HistoryPoint[] | null>(null)
  const [histErr, setHistErr] = useState(false)
  const [source, setSource] = useState("")

  useEffect(() => {
    if (!asset) { setSeries(null); setHistErr(false); return }
    let cancelled = false
    setSeries(null); setHistErr(false)
    fetch(`/api/assets/history?name=${encodeURIComponent(asset.name)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { if (!cancelled) { setSeries(d.series); setSource(d.source ?? "") } })
      .catch(() => { if (!cancelled) setHistErr(true) })
    return () => { cancelled = true }
  }, [asset])

  useEffect(() => {
    if (!asset) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [asset, onClose])

  if (!asset) return null

  const isStock = asset.type === "stock"
  // shares: stocks divide by (purchase_price × FX); funds by purchase_nav
  const cost = buys.reduce((s, b) => s + b.amount, 0)
  const shares = buys.reduce((s, b) => {
    if (isStock && b.purchase_price && b.purchase_price > 0) return s + b.amount / (b.purchase_price * fxRate)
    if (!isStock && b.purchase_nav && b.purchase_nav > 0) return s + b.amount / b.purchase_nav
    return s
  }, 0)
  const valueMXN = isStock ? shares * currentPrice * fxRate : shares * currentPrice
  const pl = shares > 0 && currentPrice > 0 ? valueMXN - cost : 0
  const plPct = cost > 0 && shares > 0 && currentPrice > 0 ? (pl / cost) * 100 : 0
  const plColor = pl >= 0 ? C.green : C.red

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
      }} />
      <div
        role="dialog" aria-label={`${asset.name} detail`}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 201,
          background: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
          border: `1px solid ${C.border}`, borderBottom: "none",
          padding: "14px 18px max(env(safe-area-inset-bottom, 16px), 16px)",
          maxHeight: "88vh", overflowY: "auto",
          boxShadow: "0 -16px 40px rgba(0,0,0,0.5)",
          animation: "ftSheetIn 200ms ease-out",
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 14px" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: isStock ? C.blueDim : C.purpleDim,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 800, color: isStock ? C.blue : C.purple,
            }}>{asset.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.strong, letterSpacing: "-0.3px", display: "flex", alignItems: "center", gap: 8 }}>
                {asset.name}
                <Tag color={asset.gf ? C.pink : isStock ? C.blue : C.purple}>{asset.gf ? "GF" : "Mine"}</Tag>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{isStock ? "Stock" : "Fund"}{source ? ` · ${source}` : ""}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, padding: 6 }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <StatBox label="Position value" value={`${fmt(valueMXN)} MXN`} accent={C.text} />
          <StatBox label="P&L" value={`${pl >= 0 ? "+" : ""}${fmt(pl)} · ${plPct >= 0 ? "+" : ""}${plPct.toFixed(1)}%`} accent={plColor} />
          <StatBox label="Cost basis" value={`${fmt(cost)} MXN`} accent={C.muted} />
          <StatBox label={isStock ? "Shares" : "Units"} value={shares > 0 ? shares.toFixed(4) : "—"} accent={C.muted} />
        </div>

        {/* Price chart with buy markers */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "16px 14px 12px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
              Price · 6 mo
            </span>
            {currentPrice > 0 && (
              <span style={{ fontSize: 15, fontWeight: 800, color: isStock ? C.blue : C.purple, fontVariantNumeric: "tabular-nums" }}>
                {isStock ? `$${currentPrice.toFixed(2)} USD` : `${currentPrice.toFixed(4)} MXN`}
              </span>
            )}
          </div>
          {series === null && !histErr && <Shimmer width="100%" height={120} radius={10} />}
          {histErr && (
            <div style={{ fontSize: 11.5, color: C.dim, textAlign: "center", padding: "32px 0" }}>
              No price history available for this asset.
            </div>
          )}
          {series && series.length >= 2 && (
            <PriceChart series={series} buys={buys} isStock={isStock} color={isStock ? C.blue : C.purple} />
          )}
        </div>

        {/* Buys list */}
        <div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 8 }}>
          Buys · {buys.length}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
          {[...buys].sort((a, b) => b.date.localeCompare(a.date)).map((b, i, arr) => {
            const buyPrice = isStock ? b.purchase_price : b.purchase_nav
            return (
              <div key={b.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 14px",
                borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{fmtDate(b.date)}</div>
                  <div style={{ fontSize: 10.5, color: C.dim, marginTop: 2 }}>
                    {buyPrice ? (isStock ? `@ $${buyPrice.toFixed(2)} USD` : `@ ${buyPrice.toFixed(4)} NAV`) : "no entry price"}
                    {b.historical ? " · historical" : ""}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{fmt(b.amount)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function StatBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px" }}>
      <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: accent, marginTop: 5, letterSpacing: "-0.3px", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  )
}

function PriceChart({ series, buys, isStock, color }: { series: HistoryPoint[]; buys: Investment[]; isStock: boolean; color: string }) {
  const W = 320, H = 130, pad = 8
  const prices = series.map(p => p.price)
  const min = Math.min(...prices), max = Math.max(...prices)
  const span = max - min || 1
  const t0 = new Date(series[0].date).getTime()
  const t1 = new Date(series[series.length - 1].date).getTime()
  const tSpan = t1 - t0 || 1
  const X = (d: string) => pad + ((new Date(d).getTime() - t0) / tSpan) * (W - pad * 2)
  const Y = (p: number) => H - pad - ((p - min) / span) * (H - pad * 2)
  const path = series.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.date).toFixed(1)},${Y(p.price).toFixed(1)}`).join(" ")
  const area = `${path} L${X(series[series.length - 1].date).toFixed(1)},${H} L${X(series[0].date).toFixed(1)},${H} Z`
  const gid = `adlg${color.replace(/[^a-z0-9]/gi, "")}`
  // Buy markers: only those inside the chart window with an entry price
  const markers = buys
    .map(b => ({ date: b.date, price: isStock ? b.purchase_price : b.purchase_nav }))
    .filter((m): m is { date: string; price: number } => {
      if (typeof m.price !== "number" || m.price <= 0) return false
      const t = new Date(m.date).getTime()
      return t >= t0 && t <= t1 && m.price >= min - span * 0.1 && m.price <= max + span * 0.1
    })
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 14}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Buy markers */}
      {markers.map((m, i) => (
        <g key={i}>
          <circle cx={X(m.date)} cy={Y(m.price)} r={5} fill={C.green} stroke={C.bg} strokeWidth={2}>
            <title>Buy {m.date} @ {m.price.toFixed(isStock ? 2 : 4)}</title>
          </circle>
        </g>
      ))}
      {/* End dot */}
      <circle cx={X(series[series.length - 1].date)} cy={Y(series[series.length - 1].price)} r={4} fill={C.bg} stroke={color} strokeWidth={2.5} />
      {/* X labels: first / mid / last */}
      {[0, Math.floor(series.length / 2), series.length - 1].map(i => (
        <text key={i} x={X(series[i].date)} y={H + 12} textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"} fontSize={8.5} fill={C.dim}>
          {fmtDate(series[i].date)}
        </text>
      ))}
    </svg>
  )
}
