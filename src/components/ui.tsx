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
    <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
      <div style={{ display: "inline-flex", marginBottom: 14, color: C.dim }}>
        <Icon name={icon} size={34} stroke={1.6} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.muted, marginBottom: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: C.dim }}>{sub}</div>}
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
  rightExtra?: React.ReactNode
  isLast?: boolean
}
export function EntryRow({ icon, iconBg, name, sub, amount, amtColor, onDel, rightExtra, isLast }: EntryRowProps) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
      borderBottom: isLast ? "none" : `1px solid ${C.border}`,
    }}>
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
        <button onClick={onDel} style={{
          background: "none", border: "none", cursor: "pointer", color: C.dim,
          padding: 2, flexShrink: 0, display: "flex",
        }}>
          <Icon name="close" size={16} />
        </button>
      )}
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
