import * as React from "react"
import { C, type Bucket } from "@/lib/utils"
import { Icon } from "./Icon"

/* ── Section label (uppercase caption) ───────────────────────────── */
export function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, color: C.muted, textTransform: "uppercase",
      letterSpacing: "0.08em", fontWeight: 600, marginBottom: 12, ...style,
    }}>{children}</div>
  )
}

/* ── Tag pill ────────────────────────────────────────────────────── */
export function Tag({ children, color = C.muted, solid = false, style }: { children: React.ReactNode; color?: string; solid?: boolean; style?: React.CSSProperties }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", flexShrink: 0,
      fontSize: 9.5, fontWeight: 700, letterSpacing: "0.02em",
      padding: "3px 8px", borderRadius: 6,
      background: solid ? color : color + "22",
      color: solid ? "#0E0F12" : color,
      ...style,
    }}>{children}</span>
  )
}
export function BucketTag({ bucket }: { bucket: Bucket }) {
  return <Tag color={bucket.color}>{bucket.label}</Tag>
}

/* ── Empty state ─────────────────────────────────────────────────── */
export function Empty({ icon, label, sub }: { icon: string; label: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "2.5rem 1rem 2rem" }}>
      <div style={{
        display: "inline-flex", marginBottom: 16,
        width: 64, height: 64, borderRadius: 20,
        background: `linear-gradient(135deg, ${C.cardHi} 0%, ${C.card} 100%)`,
        border: `1px solid ${C.border}`,
        alignItems: "center", justifyContent: "center",
        color: C.muted,
      }}>
        <Icon name={icon} size={28} stroke={1.6} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4, letterSpacing: "-0.2px" }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, maxWidth: 280, margin: "0 auto" }}>{sub}</div>}
    </div>
  )
}

/* ── Search bar ──────────────────────────────────────────────────── */
export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: "relative", marginBottom: 12 }}>
      <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: C.muted, pointerEvents: "none", display: "flex" }}>
        <Icon name="search" size={16} />
      </span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || "Search…"}
        style={{
          width: "100%", padding: "11px 12px 11px 38px", fontSize: 14,
          fontFamily: "inherit", border: `1px solid ${C.border}`, borderRadius: 12,
          background: C.surface, color: C.text, outline: "none", boxSizing: "border-box",
        }}
      />
      {value && (
        <button onClick={() => onChange("")} style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", color: C.muted, cursor: "pointer", display: "flex", padding: 4,
        }}>
          <Icon name="close" size={15} />
        </button>
      )}
    </div>
  )
}

/* ── Segmented toggle ────────────────────────────────────────────── */
interface ToggleRowProps<T extends string> {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  style?: React.CSSProperties
}
export function ToggleRow<T extends string>({ value, onChange, options, style }: ToggleRowProps<T>) {
  return (
    <div style={{
      display: "flex", background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: 3, marginBottom: 10, gap: 3, ...style,
    }}>
      {options.map(o => {
        const on = value === o.value
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            flex: 1, padding: "9px 4px", fontSize: 12.5, fontFamily: "inherit",
            fontWeight: on ? 600 : 500, border: "none", borderRadius: 9, cursor: "pointer",
            background: on ? C.cardHi : "transparent",
            color: on ? C.strong : C.muted, transition: "all .15s",
          }}>{o.label}</button>
        )
      })}
    </div>
  )
}

/* ── Card shell ──────────────────────────────────────────────────── */
export function Card({ children, style, glow }: { children: React.ReactNode; style?: React.CSSProperties; glow?: string }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
      position: "relative", overflow: "hidden", ...style,
    }}>
      {glow && (
        <div style={{
          position: "absolute", top: -40, right: -40, width: 140, height: 140,
          borderRadius: "50%", background: glow, opacity: 0.10, pointerEvents: "none",
        }} />
      )}
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  )
}

/* ── Transaction row ─────────────────────────────────────────────── */
interface EntryRowProps {
  icon: React.ReactNode
  iconBg: string
  name: React.ReactNode
  sub: React.ReactNode
  amount: React.ReactNode
  amtColor: string
  onDel?: (() => void) | null
  onEdit?: (() => void) | null
  rightExtra?: React.ReactNode
  isLast?: boolean
  index?: number   // optional position used for stagger delay
}
/** Width of the revealed swipe-action area (px). One or two 64px buttons. */
const SWIPE_ACTION = 64

export function EntryRow({ icon, iconBg, name, sub, amount, amtColor, onDel, onEdit, rightExtra, isLast, index }: EntryRowProps) {
  const [pressed, setPressed] = React.useState(false)
  const [dragX, setDragX] = React.useState(0)        // current translateX (≤ 0)
  const [openX, setOpenX] = React.useState(0)        // settled position
  const [animating, setAnimating] = React.useState(true)
  const touchRef = React.useRef<{ x: number; y: number; swiping: boolean | null } | null>(null)
  const actionsWidth = (onEdit ? SWIPE_ACTION : 0) + (onDel ? SWIPE_ACTION : 0)
  // Cap stagger so a 50-item list doesn't take 1.5s to fully reveal
  const delay = index != null ? Math.min(index, 12) * 25 : 0

  const onTouchStart = (e: React.TouchEvent) => {
    if (actionsWidth === 0) return
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, swiping: null }
    setAnimating(false)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const ref = touchRef.current
    if (!ref) return
    const t = e.touches[0]
    const dx = t.clientX - ref.x
    const dy = t.clientY - ref.y
    // Lock direction on the first meaningful move: horizontal → swipe, vertical → scroll
    if (ref.swiping === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      ref.swiping = Math.abs(dx) > Math.abs(dy)
    }
    if (!ref.swiping) return
    const next = Math.max(-actionsWidth - 16, Math.min(0, openX + dx))
    setDragX(next)
  }
  const onTouchEnd = () => {
    const ref = touchRef.current
    touchRef.current = null
    setAnimating(true)
    if (!ref?.swiping) return
    // Snap: open if dragged past half the action area, else close
    const settled = dragX < -actionsWidth / 2 ? -actionsWidth : 0
    setOpenX(settled)
    setDragX(settled)
  }
  const wasSwiped = openX !== 0
  const closeSwipe = () => { setOpenX(0); setDragX(0) }

  return (
    <div
      className="ft-row-in"
      style={{
        position: "relative", overflow: "hidden",
        borderBottom: isLast ? "none" : `1px solid ${C.border}`,
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Action layer behind the row */}
      {actionsWidth > 0 && (
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, display: "flex" }}>
          {onEdit && (
            <button
              onClick={() => { closeSwipe(); onEdit() }}
              style={{
                width: SWIPE_ACTION, border: "none", cursor: "pointer",
                background: C.blueDim, color: C.blue,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                fontSize: 9.5, fontWeight: 700, fontFamily: "inherit",
              }}
            >
              <Icon name="expenses" size={16} color={C.blue} />Edit
            </button>
          )}
          {onDel && (
            <button
              onClick={() => { closeSwipe(); onDel() }}
              style={{
                width: SWIPE_ACTION, border: "none", cursor: "pointer",
                background: C.redDim, color: C.red,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                fontSize: 9.5, fontWeight: 700, fontFamily: "inherit",
              }}
            >
              <Icon name="trash" size={16} color={C.red} />Delete
            </button>
          )}
        </div>
      )}

      {/* Foreground row */}
      <div
        onClick={() => {
          if (wasSwiped) { closeSwipe(); return }
          onEdit?.()
        }}
        onPointerDown={() => onEdit && setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
          cursor: onEdit ? "pointer" : undefined,
          WebkitTapHighlightColor: "transparent",
          background: pressed && !wasSwiped ? C.cardHi : C.card,
          transform: `translateX(${dragX}px)`,
          transition: animating
            ? "transform 200ms cubic-bezier(0.4,0,0.2,1), background 100ms cubic-bezier(0.4,0,0.2,1)"
            : "background 100ms cubic-bezier(0.4,0,0.2,1)",
          position: "relative",
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 11, background: iconBg,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>{sub}</div>
        </div>
        {rightExtra}
        <div style={{ fontSize: 15, fontWeight: 700, color: amtColor, flexShrink: 0, letterSpacing: "-0.3px" }}>{amount}</div>
        {onDel && (
          <button
            onClick={e => { e.stopPropagation(); onDel() }}
            style={{
              background: "none", border: "none", cursor: "pointer", color: C.dim,
              padding: 2, flexShrink: 0, display: "flex",
            }}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Form sheet ──────────────────────────────────────────────────── */
interface FormSheetProps {
  title: string
  children: React.ReactNode
  onSubmit: () => void
  submitLabel: string
  onCancel: () => void
  accent?: string
}
export function FormSheet({ title, children, onSubmit, submitLabel, onCancel, accent = C.green }: FormSheetProps) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
      padding: 18, marginBottom: 16,
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.strong, marginBottom: 16, letterSpacing: "-0.3px" }}>{title}</div>
      {children}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: 13, fontSize: 14, fontFamily: "inherit", fontWeight: 500,
          border: `1px solid ${C.border}`, borderRadius: 14, cursor: "pointer",
          background: "transparent", color: C.muted,
        }}>Cancel</button>
        <button onClick={onSubmit} style={{
          flex: 2, padding: 13, fontSize: 14, fontFamily: "inherit", fontWeight: 700,
          border: "none", borderRadius: 14, cursor: "pointer", background: accent, color: "#0E0F12",
        }}>{submitLabel}</button>
      </div>
    </div>
  )
}

/* ── FAB ─────────────────────────────────────────────────────────── */
export function FAB({ label, icon, onClick, color = C.green, ghost }: { label: string; icon: string; onClick: () => void; color?: string; ghost?: boolean }) {
  return (
    <div style={{
      position: "sticky", bottom: 14, display: "flex", justifyContent: "flex-end",
      padding: "0 2px", marginTop: 14, pointerEvents: "none",
    }}>
      <button onClick={onClick} style={{
        pointerEvents: "all", display: "inline-flex", alignItems: "center", gap: 7,
        padding: "13px 22px", fontSize: 14, fontFamily: "inherit", fontWeight: 700,
        letterSpacing: "-0.2px",
        border: ghost ? `1px solid ${C.border}` : "none", borderRadius: 100, cursor: "pointer",
        background: ghost ? C.surface : color, color: ghost ? C.muted : "#0E0F12",
        boxShadow: ghost ? "none" : `0 8px 24px ${color}40`,
      }}>
        {icon && <Icon name={icon} size={17} color={ghost ? C.muted : "#0E0F12"} />}
        {label}
      </button>
    </div>
  )
}

/* ── Month navigator ─────────────────────────────────────────────── */
export function MonthNav({ moName, vy, onPrev, onNext, atCurrent }: { moName: string; vy: number; onPrev: () => void; onNext: () => void; atCurrent: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: "8px 10px", marginBottom: 14,
    }}>
      <button onClick={onPrev} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, display: "flex", padding: 6 }}>
        <Icon name="chevL" size={20} />
      </button>
      <span style={{ fontSize: 14.5, fontWeight: 700, color: C.text, letterSpacing: "-0.2px", whiteSpace: "nowrap" }}>{moName} {vy}</span>
      <button
        onClick={onNext}
        disabled={atCurrent}
        style={{
          background: "none", border: "none", cursor: atCurrent ? "default" : "pointer",
          color: atCurrent ? C.dim : C.muted, display: "flex", padding: 6,
        }}
      >
        <Icon name="chevR" size={20} />
      </button>
    </div>
  )
}

/* ── Shared input styles ─────────────────────────────────────────── */
export const inp: React.CSSProperties = {
  width: "100%", padding: "12px 14px", fontSize: 15, fontFamily: "inherit",
  border: `1px solid ${C.border}`, borderRadius: 12, background: C.bg, color: C.text,
  marginBottom: 10, outline: "none", boxSizing: "border-box",
}
export const lbl: React.CSSProperties = {
  fontSize: 11, color: C.muted, display: "block", marginBottom: 6,
  textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
}
