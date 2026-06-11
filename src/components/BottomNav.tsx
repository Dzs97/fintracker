"use client"
import { C, buzz } from "@/lib/utils"
import { Icon } from "./Icon"

export type NavTab = "Home" | "Money" | "Cards" | "Invest"

interface Props {
  active: NavTab
  onChange: (t: NavTab) => void
  onCenterAction?: () => void
}

const TABS: Array<{ id: NavTab; label: string; icon: string }> = [
  { id: "Home",   label: "Home",   icon: "overview" },
  { id: "Money",  label: "Money",  icon: "expenses" },
  { id: "Cards",  label: "Cards",  icon: "cards"    },
  { id: "Invest", label: "Invest", icon: "invest"   },
]

export function BottomNav({ active, onChange, onCenterAction }: Props) {
  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50,
      background: `${C.surface}F8`,
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderTop: `1px solid ${C.border}`,
      padding: "8px 8px max(env(safe-area-inset-bottom, 8px), 8px)",
    }}>
      <div style={{ display: "flex", alignItems: "stretch", maxWidth: 540, margin: "0 auto", position: "relative" }}>
        {/* Left two tabs */}
        {TABS.slice(0, 2).map(t => <NavButton key={t.id} tab={t} active={active === t.id} onClick={() => onChange(t.id)} />)}

        {/* Center FAB */}
        <div style={{ flex: 0, position: "relative", width: 64, display: "flex", justifyContent: "center" }}>
          <button onClick={() => { buzz(); onCenterAction?.() }} aria-label="Quick log" style={{
            position: "absolute", top: -22,
            width: 56, height: 56, borderRadius: 28,
            background: C.green, border: `4px solid ${C.bg}`,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 12px 28px ${C.green}55, 0 4px 8px ${C.green}33`,
            transition: "transform 150ms cubic-bezier(0.4,0,0.2,1)",
          }}
            onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.92)" }}
            onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)" }}
          >
            <Icon name="plus" size={26} color="#0B0D11" />
          </button>
        </div>

        {/* Right two tabs */}
        {TABS.slice(2).map(t => <NavButton key={t.id} tab={t} active={active === t.id} onClick={() => onChange(t.id)} />)}
      </div>
    </div>
  )
}

function NavButton({ tab, active, onClick }: { tab: typeof TABS[number]; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "8px 4px", border: "none", background: "transparent",
      cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      color: active ? C.green : C.muted,
      WebkitTapHighlightColor: "transparent",
      transition: "color 150ms cubic-bezier(0.4,0,0.2,1)",
    }}>
      <div style={{
        padding: "5px 14px", borderRadius: 100,
        background: active ? C.green + "1A" : "transparent",
        transition: "background 200ms cubic-bezier(0.4,0,0.2,1)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={tab.icon} size={22} color={active ? C.green : C.muted} fill={tab.id === "Home"} />
      </div>
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: "0.02em" }}>{tab.label}</span>
    </button>
  )
}
