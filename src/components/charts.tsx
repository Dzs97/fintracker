import { C, fmt } from "@/lib/utils"

interface Point { label: string; v: number }
interface DonutDatum { label: string; v: number; color: string }

export function SparkBar({ data, color, height = 64 }: { data: Point[]; color: string; height?: number }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.v), 1)
  const W = 280, H = height, gap = 7
  const bw = Math.max(6, Math.floor((W - gap * (data.length - 1)) / data.length))
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
      {[0.25, 0.5, 0.75, 1].map(p => (
        <line key={p} x1={0} y1={Math.round(H - p * H)} x2={W} y2={Math.round(H - p * H)} stroke={C.border} strokeWidth={1} />
      ))}
      {data.map((d, i) => {
        const bh = Math.max(3, Math.round((d.v / max) * H))
        return (
          <g key={i}>
            <rect x={i * (bw + gap)} y={H - bh} width={bw} height={bh} rx={4} fill={color} opacity={0.9} />
            <title>{d.label}: {fmt(d.v)}</title>
          </g>
        )
      })}
    </svg>
  )
}

export function LineChart({ points, color, height = 74 }: { points: Point[]; color: string; height?: number }) {
  if (points.length < 2) return null
  const max = Math.max(...points.map(p => p.v), 1)
  const W = 280, H = height, pad = 8
  const xs = points.map((_, i) => pad + i * ((W - pad * 2) / (points.length - 1)))
  const ys = points.map(p => H - pad - (p.v / max) * (H - pad * 2))
  const gridYs = [0.25, 0.5, 0.75, 1].map(p => Math.round(H - pad - p * (H - pad * 2)))
  const pathD = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ")
  const areaD = `${pathD} L${xs[xs.length - 1]},${H} L${xs[0]},${H} Z`
  const gid = `lg${color.replace(/[^a-z0-9]/gi, "")}`
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridYs.map(y => <line key={y} x1={pad} y1={y} x2={W - pad} y2={y} stroke={C.border} strokeWidth={1} />)}
      <path d={areaD} fill={`url(#${gid})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={xs[i]} cy={ys[i]} r={3.5} fill={C.bg} stroke={color} strokeWidth={2}>
          <title>{p.label}: {fmt(p.v)}</title>
        </circle>
      ))}
    </svg>
  )
}

export function Donut({ data, size = 112 }: { data: DonutDatum[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.v, 0)
  if (!total) return <div style={{ width: size, height: size, borderRadius: "50%", background: C.border, flexShrink: 0 }} />
  const R = 46, cx = 60, cy = 60, circ = 2 * Math.PI * R
  let off = 0
  const slices = data.map(d => {
    const dash = (d.v / total) * circ
    const s = { dash, offset: off, color: d.color }
    off += dash
    return s
  })
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={C.border} strokeWidth={13} />
      {slices.map((s, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={R}
          fill="none" stroke={s.color} strokeWidth={13}
          strokeDasharray={`${s.dash} ${circ - s.dash}`}
          strokeDashoffset={-s.offset + circ * 0.25}
          strokeLinecap="butt"
          style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
        />
      ))}
      <text x={cx} y={cy - 3} textAnchor="middle" fill={C.strong} fontSize={14} fontWeight={700} letterSpacing="-0.5">{fmt(total)}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill={C.muted} fontSize={9} letterSpacing="0.5">MXN</text>
    </svg>
  )
}
