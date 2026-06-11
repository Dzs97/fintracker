"use client"
import { C } from "@/lib/utils"
import { Icon } from "./Icon"

interface Props {
  name?: string
  moName: string
  vy: number
  onPrev: () => void
  onNext: () => void
  atCurrent: boolean
  onQuickLog?: () => void
  onRefresh?: () => void
  refreshing?: boolean
}

const HELLOS = ["Hola", "Hey", "Hi"]
function pickGreeting(name: string | undefined): { hi: string; sub: string } {
  const h = new Date().getHours()
  const time = h < 6 ? "Late night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
  const hi = HELLOS[(name?.length ?? 0) % HELLOS.length] + (name ? `, ${name}` : "")
  return { hi, sub: time }
}

export function TopBar({ name, moName, vy, onPrev, onNext, atCurrent, onQuickLog, onRefresh, refreshing }: Props) {
  const { hi, sub } = pickGreeting(name)
  const initials = (name ?? "FT").trim().slice(0, 2).toUpperCase()
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 10,
      background: `linear-gradient(180deg, ${C.bg} 70%, ${C.bg}00 100%)`,
      padding: "max(env(safe-area-inset-top, 16px), 16px) 16px 12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.purple} 0%, ${C.pink} 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: "#FFFFFF",
            letterSpacing: "-0.3px", flexShrink: 0,
          }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.strong, lineHeight: 1.1, letterSpacing: "-0.3px" }}>{hi}</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{sub}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onQuickLog && (
            <button onClick={onQuickLog} aria-label="Quick log" style={{
              width: 38, height: 38, borderRadius: 12,
              background: C.green, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 6px 20px ${C.green}40`,
            }}>
              <Icon name="plus" size={18} color="#0B0D11" />
            </button>
          )}
          {onRefresh && (
            <button onClick={onRefresh} aria-label="Refresh" style={{
              width: 38, height: 38, borderRadius: 12,
              background: C.surface, border: `1px solid ${C.border}`, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "transform 0.5s",
              transform: refreshing ? "rotate(-180deg)" : "rotate(0deg)",
            }}>
              <Icon name="refresh" size={16} color={refreshing ? C.green : C.muted} />
            </button>
          )}
        </div>
      </div>

      {/* Month navigator pill */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "6px 6px 6px 14px",
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 100,
      }}>
        <button onClick={onPrev} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, display: "flex", padding: 4 }}>
          <Icon name="chevL" size={16} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: "-0.2px", whiteSpace: "nowrap" }}>
          {moName} {vy}
        </span>
        <button onClick={onNext} disabled={atCurrent} style={{
          background: "none", border: "none", cursor: atCurrent ? "default" : "pointer",
          color: atCurrent ? C.dim : C.muted, display: "flex", padding: 4,
        }}>
          <Icon name="chevR" size={16} />
        </button>
      </div>
    </div>
  )
}
