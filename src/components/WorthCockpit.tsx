"use client"
import { useState } from "react"
import { C, G, fmt } from "@/lib/utils"
import { Icon } from "./Icon"
import type { Account, Goal } from "@/types"

interface Props {
  fxRate: number              // USD→MXN
  accounts: Account[]
  goals: Goal[]
  investmentValueMXN: number  // live value of all investments
  cardDebtMXN: number         // total owed across cards
}

export function WorthCockpit({ fxRate, accounts, goals, investmentValueMXN, cardDebtMXN }: Props) {
  const [ccy, setCcy] = useState<"MXN" | "USD">("MXN")
  const toMXN = (amt: number, c: "MXN" | "USD") => (c === "USD" ? amt * fxRate : amt)
  const disp = (mxn: number) => (ccy === "USD" ? mxn / fxRate : mxn)

  const cashMXN = accounts.reduce((s, a) => s + toMXN(a.balance, a.currency), 0)
  const assetsMXN = cashMXN + investmentValueMXN
  const netMXN = assetsMXN - cardDebtMXN
  const sym = ccy === "USD" ? "USD" : "MXN"

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
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-1.5px", color: netMXN >= 0 ? C.green : C.red, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {netMXN < 0 ? "−" : ""}{fmt(Math.abs(disp(netMXN)))}<span style={{ fontSize: 14, fontWeight: 500, color: C.muted, marginLeft: 7 }}>{sym}</span>
          </div>
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
        </div>
      </div>

      {/* Goals */}
      {goals.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {goals.map(goal => {
            const isDebtFree = goal.kind === "debt-free"
            const tgtMXN = toMXN(goal.target, goal.currency)
            // debt-free: current = remaining card debt (lower=better); savings: current toward target
            const curMXN = isDebtFree ? cardDebtMXN : toMXN(goal.current ?? 0, goal.currency)
            const pct = isDebtFree
              ? (cardDebtMXN <= 0 ? 100 : 0)           // simple: done when debt hits 0
              : Math.min(100, tgtMXN > 0 ? (curMXN / tgtMXN) * 100 : 0)
            const color = isDebtFree ? C.amber : C.green
            const days = goal.targetDate ? Math.ceil((new Date(goal.targetDate + "T00:00:00").getTime() - Date.now()) / 86400000) : null
            return (
              <div key={goal.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{goal.title}</span>
                  {days != null && (
                    <span style={{ fontSize: 10.5, color: days < 0 ? C.red : C.dim }}>
                      {days < 0 ? `${-days}d ago` : `${days}d left`}
                    </span>
                  )}
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
