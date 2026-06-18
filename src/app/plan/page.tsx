"use client"
import { useEffect, useState } from "react"
import { C, G } from "@/lib/utils"
import { Icon } from "@/components/Icon"

/* ── The waterfall (Scenario B: HSA + commuter, skip 401k) ──────────── */
const WATERFALL: Array<{ n: string; title: string; what: string; why: string; color: string }> = [
  { n: "1", title: "Kill toxic debt", color: C.red,
    what: "Clear the 96% / 48.5% / 43% balances first (done by ~Oct–Nov from your first US paychecks).",
    why: "A guaranteed 40–96% 'return.' No investment beats paying this off." },
  { n: "2", title: "Commuter benefit", color: C.amber,
    what: "Enroll, run BART/Muni (~$200/mo) through it pre-tax. Fund only what you'll spend.",
    why: "~41% off transit you ride anyway — ~$980/yr. Free efficiency, no lock-up." },
  { n: "3", title: "Emergency fund", color: C.blue,
    what: "~3 months of lean expenses (~$8–9k USD) in a US high-yield savings account (~4–5%).",
    why: "Safety, currency-matched to your USD life, instant access." },
  { n: "4", title: "HSA — max it (~$4,400)", color: C.green,
    what: "Elect the HDHP plan, max the HSA, invest it, pay medical out-of-pocket & hoard receipts.",
    why: "Triple tax-free (best account in the US). Receipts = reimburse yourself anytime, even from Asia." },
  { n: "5", title: "Roth IRA — max ($7,000)", color: C.purple,
    what: "Open at Fidelity/Schwab/Vanguard. Contribute after-tax, invest in index funds.",
    why: "Tax-free growth, and your contributions stay withdrawable penalty-free — flexible even if you leave." },
  { n: "6", title: "Taxable brokerage", color: C.teal,
    what: "Everything else → VTI (US) or VT (world). This is the bulk: your liquid Asia fund.",
    why: "No limits, no lock-up, you'll spend it in ~3 years. Hold >1yr for low capital-gains rates." },
  { n: "7", title: "Skip the 401(k)", color: C.dim,
    what: "No employer match + locked until 59½. Don't fund it (or keep tiny).",
    why: "Biggest tax deduction, but you'd pay a 10% penalty to touch money you need in 3 years." },
]

const CHECKLIST = [
  "Elect the HDHP (HSA-eligible health plan)",
  "Set HSA contribution to the annual max (~$4,400)",
  "Enroll commuter benefit · set to ~$200/mo (transit only)",
  "Open a US high-yield savings account (emergency fund)",
  "Open a Roth IRA (Fidelity / Schwab / Vanguard)",
  "Open a taxable brokerage account",
  "Decline / minimize the 401(k)",
  "Set auto-invest into VTI or VT",
]

export default function PlanPage() {
  const [done, setDone] = useState<boolean[]>(() => CHECKLIST.map(() => false))
  useEffect(() => {
    try { const s = localStorage.getItem("ft:planChecklist"); if (s) setDone(JSON.parse(s)) } catch {}
  }, [])
  const toggle = (i: number) => setDone(d => {
    const next = d.map((v, j) => j === i ? !v : v)
    try { localStorage.setItem("ft:planChecklist", JSON.stringify(next)) } catch {}
    return next
  })
  const doneCount = done.filter(Boolean).length

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: "max(env(safe-area-inset-top,16px),16px) 16px 8px" }}>
        <a href="/dashboard" style={{ fontSize: 13, color: C.muted, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Icon name="chevL" size={14} color={C.muted} /> Dashboard
        </a>
      </div>
      <div style={{ padding: "8px 16px 0" }}>
        <div style={{
          background: G.hero, borderRadius: 22, padding: "22px 20px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>Plan</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", marginTop: 4 }}>US Money Plan</div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", marginTop: 8, lineHeight: 1.5 }}>
            $130k · Berkeley (lean) · bi-weekly pay.<br />
            Debt-free ~Oct–Nov → save for Asia (~3 yrs).
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {[
              { k: "Per check", v: "$3,292" },
              { k: "Per month", v: "$7,132" },
              { k: "Asia fund", v: "~$150k+" },
            ].map(x => (
              <div key={x.k} style={{ flex: 1, background: "rgba(0,0,0,0.18)", borderRadius: 12, padding: "10px 12px", backdropFilter: "blur(8px)" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{x.k}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginTop: 3, letterSpacing: "-0.3px" }}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bi-weekly pay stub */}
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 12 }}>Your paycheck · bi-weekly (×26/yr)</div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
          {([
            ["Gross pay", "$5,000.00", C.text, false],
            ["HSA (pre-tax)", "−$169.23", C.green, false],
            ["Commuter (pre-tax)", "−$92.31", C.amber, false],
            ["Federal tax", "−$723.65", C.muted, false],
            ["CA state tax", "−$303.61", C.muted, false],
            ["FICA (SS + Medicare)", "−$362.49", C.muted, false],
            ["CA SDI", "−$56.86", C.muted, false],
            ["Net deposit", "$3,291.84", C.green, true],
          ] as [string, string, string, boolean][]).map(([label, val, color, bold], i, arr) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: bold ? "14px 16px" : "10px 16px",
              borderTop: bold ? `1px solid ${C.border}` : "none",
              background: bold ? C.cardHi : "transparent",
            }}>
              <span style={{ fontSize: bold ? 13.5 : 12.5, color: bold ? C.text : C.muted, fontWeight: bold ? 700 : 500 }}>{label}</span>
              <span style={{ fontSize: bold ? 16 : 13, fontWeight: bold ? 800 : 600, color, fontVariantNumeric: "tabular-nums" }}>{val}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: C.dim, marginTop: 8, lineHeight: 1.5 }}>
          Single · standard W-4 · 28.9% effective tax. 2026 brackets land slightly more
          favorable, and your Sept start means a 2026 refund. Real check ≈ this ±1%.
        </div>
      </div>

      {/* Monthly allocation */}
      <div style={{ padding: "24px 16px 0" }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 12 }}>Where the ~$7,132/mo goes</div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "8px 16px" }}>
          {([
            ["Berkeley life (rent, food, transit)", "~$2,800", C.blue],
            ["GF rent ($27k MXN)", "~$1,588", C.pink],
            ["→ Debt now / Asia fund after Nov", "~$2,744", C.green],
          ] as [string, string, string][]).map(([label, val, color], i, arr) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
              padding: "11px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
            }}>
              <span style={{ fontSize: 12.5, color: C.text }}>{label}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ padding: "24px 16px 0" }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 12 }}>Road to debt-free → Asia</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {([
            ["Jun–Aug", "Survive on MX income. Kill the 96%, minimums, no new debt.", C.amber],
            ["Sep", "Relocate + 1st US paycheck. Move costs in cash, not credit.", C.blue],
            ["Oct–Nov", "Berkeley paychecks wipe the toxic 40%+ debt.", C.green],
            ["Dec '26", "Completely debt-free. Waterfall begins.", C.green],
            ["2027–29", "Save ~$2,744/mo → invest. Asia fund ~$150k+.", C.purple],
          ] as [string, string, string][]).map(([when, what, color], i, arr) => (
            <div key={when} style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: color, marginTop: 4 }} />
                {i < arr.length - 1 && <div style={{ width: 2, flex: 1, background: C.border, marginTop: 2 }} />}
              </div>
              <div style={{ paddingBottom: i < arr.length - 1 ? 16 : 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color }}>{when}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>{what}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Waterfall */}
      <div style={{ padding: "24px 16px 0" }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 12 }}>The waterfall — fill in order</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {WATERFALL.map(s => (
            <div key={s.n} style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
              padding: "14px 16px", display: "flex", gap: 12,
              opacity: s.n === "7" ? 0.7 : 1,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: s.color + "22", color: s.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800,
              }}>{s.n}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: s.n === "7" ? C.muted : C.text, textDecoration: s.n === "7" ? "line-through" : "none" }}>{s.title}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{s.what}</div>
                <div style={{ fontSize: 11.5, color: s.color, marginTop: 5, lineHeight: 1.5 }}>{s.why}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Enrollment checklist */}
      <div style={{ padding: "24px 16px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>September enrollment</div>
          <div style={{ fontSize: 11, color: doneCount === CHECKLIST.length ? C.green : C.dim, fontWeight: 700 }}>{doneCount}/{CHECKLIST.length}</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
          {CHECKLIST.map((item, i) => (
            <button key={i} onClick={() => toggle(i)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "13px 16px", cursor: "pointer", textAlign: "left",
              background: "transparent", border: "none",
              borderBottom: i < CHECKLIST.length - 1 ? `1px solid ${C.border}` : "none",
              WebkitTapHighlightColor: "transparent",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                border: done[i] ? "none" : `1.5px solid ${C.borderHi}`,
                background: done[i] ? C.green : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 150ms cubic-bezier(0.4,0,0.2,1)",
              }}>
                {done[i] && <Icon name="check" size={13} color="#0B0D11" />}
              </div>
              <span style={{ fontSize: 13.5, color: done[i] ? C.dim : C.text, textDecoration: done[i] ? "line-through" : "none" }}>{item}</span>
            </button>
          ))}
        </div>
      </div>

      {/* One-liner footer */}
      <div style={{ padding: "24px 16px 0" }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
          <span style={{ color: C.text, fontWeight: 700 }}>The rule in one line:</span> pre-tax beats after-tax,
          tax-free growth beats taxed, accessible beats locked — so fill HSA &amp; Roth before plain brokerage,
          and skip the locked 401(k) with no match. Stay lean in Berkeley; the surplus flows down this list.
        </div>
      </div>
    </div>
  )
}
