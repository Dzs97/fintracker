# FinTracker — Project & Finance Context

> Handoff doc so a fresh Claude session (e.g. on a personal account) can continue this project.
> **Snapshot date: 2026-09-19.** Numbers age — re-pull from `/api/state` before asserting them as current.
> ⚠️ Contains personal financial data. Keep this file private; do **not** commit it to a public repo.

---

## 1. What this project is

Two things at once:
1. **FinTracker** — a Next.js personal-finance PWA (Diego's own app), deployed and live.
2. **Using it (with Claude) as Diego's day-to-day source of truth** for spending, debt payoff, and planning his US relocation.

Diego = **Diego Antonio Zurita Saenz** (diego@need.ai). Mexican, relocating to **San Francisco** (Sep 2026) for a US job at **Need**. Partner **Mariana Nava García** stays in Mexico.

---

## 2. The app

- **Stack:** Next.js 14 (App Router), Upstash Redis (KV store), deployed on **Vercel** (auto-deploys on `git push` to `main`).
- **Live URL:** https://fintracker-rosy.vercel.app
- **No local Node** on the dev machine → can't build/test locally. **Verify deploys** by bumping the marker in `src/app/api/debug/route.ts` (`build:` field), pushing, then polling `GET /api/debug` until the marker flips + `GET /dashboard` returns 200.
- **Design:** inline-style React, dark theme, design tokens in `src/lib/utils.ts` (`C` colors, `CAT_COLORS`).

### Logging data (curl/HTTP API — no UI needed)
- `GET /api/state` → full state (`{state:{expenses,income,cc,investments,statements,...}, accounts, cardConfig, ...}`)
- `POST/PATCH/DELETE /api/entries` — expenses & income. Body `{type:"expense"|"income", ...fields}`; PATCH/DELETE need `id`.
- `POST/PATCH/DELETE /api/cc` — credit-card charges. PATCH edits by `id`; DELETE `{id}`.
- `POST /api/statements` — upsert a statement (POST with existing `id` = update). `PATCH` records a payment (creates a Card Payments expense + increments `paid`; accepts `accountId`). `DELETE {id}`.
- `POST /api/accounts` — upsert an account (liquid accounts); `DELETE {id}`.

### Data model
- **Expense/Income:** `{id, name, amount, date, cat (expense only), note?, accountId?}`. If `accountId` set, it debits/credits that account's live balance.
- **CCCharge:** `{id, name, amount, date, cat, card, installments}`.
- **Statement:** `{id, card, period "YYYY-MM", closingBalance, totalOwed?, pagoMinimo?, paid, dueOn?, notes?}`.
- **Account:** `{id, name, currency "MXN"|"USD", balance, kind, openingDate?, note?}`. Live balance = `balance` (as of `openingDate`) + tagged income − tagged expenses (currency-normalized at FX).

### Conventions (important)
- **Categories:** Food & Dining, Transport, Housing, Health, Entertainment, Shopping, Card Payments, Pets, Groceries, Furniture, Gifts, House Supplies, Clothes, GF, Transfer, Other.
- **Excluded from spending breakdown** (`BREAKDOWN_SKIP`): `Transfer` + `Card Payments`. **Excluded from cash-flow** (`NON_SPEND`): `Transfer`. This avoids double-counting itemized card charges against card payments, and ignores own-account transfers/ATMs.
- **FX:** `state.fxRate = 16.95` (DolarApp rate −1.15%; live-refreshed). Expenses stored in **MXN**, income in **USD**.
- **Accounts:** `dolarapp` (USD, DolarApp card **·6530**), `openbank-savings` (MXN). Card last-4: OpenBank **·8433**, Amex **·3003**, Invex **·7191**.
- **Card debt** = latest statement per card, `max(0, (totalOwed ?? closingBalance) − paid)`.
- **MSI / installments:** logged as the **monthly installment** (`installments:1`, dated to that month, note "MSI installment") — NOT the full purchase amount.
- **Amex is special (deferred-plan card):** `totalOwed` = **"Saldo Pendiente de Planes"** (the deferred-plan principal) = the real debt. The **monthly bill** ("Saldo a Pagar") is day-to-day + interest + this cycle's installments; paying it keeps you current but does **not** reduce the deferred principal. Model it as: statement `closingBalance: 0`, `paid: 0` (so debt = totalOwed and the tile reads "paid this month"), and the monthly bill recorded separately as a **Card Payments expense** (cash out). Update `totalOwed` from each new statement's Saldo Pendiente.
- **Receipt photos:** extract merchant/total/date/cat/account AND keep the itemized item list in the expense `note`. Format `<account> ·<last4> — item1, item2…`.

---

## 3. Current financial snapshot (2026-09-19)

**Card debt — $146,156 MXN total (growing):**
| Card | Debt (MXN) | Notes |
|---|---:|---|
| Amex Platinum | $119,485 | Deferred-plan principal; ~3%/mo commission (~40%+/yr). The crisis. |
| Invex Volaris | $18,703 | Mostly 0% IKEA MSI + **Konfio $3.4k @ 43.94%** (highest rate). |
| OpenBank | $7,968 | Small MSI tail. **Sept statement not yet added.** |

- **Monthly financing bleed:** ~$6,682 MXN/mo (~$80k/yr) — pure commissions + interest.
- **Liquid:** DolarApp **$1,236.95 USD** (~$21k MXN) · OpenBank Savings **$5 MXN** (rent was paid from it).
- Root problem: new purchases keep getting **deferred** faster than old ones are paid down. Daily spend has shifted to DolarApp debit (good).

---

## 4. Income

- **Need (US job):** **$150k gross/yr**, semi-monthly (24/yr), started ~Sep 8 2026. Net ≈ **$8,458/mo** (single, CA resident, ~32% eff tax). First check was partial ($2,560.70).
- **Side gigs (net/mo):** Greptile $2,200 · Treeline $1,850 · Nolla $600 = **$4,650**. (1099; TN-visa-delicate — see §7.)
- **Total net ≈ $13,108/mo (~$222k MXN).** Lands in DolarApp.

**Take-home reference (salary only, single CA, no pre-tax):** $150k → ~$8,458/mo · $165k → ~$9,182/mo · $170k → ~$9,423/mo. Marginal rate on raises ~42%.

---

## 5. Debt payoff plan (Sep 2026 reset)

1. **STOP deferring** — hard rule. No new MSI / Amex deferrals; pay in full via DolarApp debit.
2. **Attack by cost, not balance:** prepay **Amex commission-bearing plans** first (prepay waives remaining commissions — ask Amex for a "cotización de pago anticipado"/early-payoff quote), then **kill Invex Konfio** (43.9%). **Leave 0% IKEA MSI** to ride out (~early 2027).
3. **Deploy US income in lump sums.** October is the attack month: once full paychecks land, prepay the ~$119k Amex plans before the Oct 8 cut → kills the ~$6,682/mo bleed. Realistic debt-free (interest-bearing): **~Q4 2026 / Q1 2027**.

**Payment schedule (dates):** OpenBank due ~2nd · Amex cuts 8th, due 21st · Invex cuts 7th, due ~28th. Paychecks: Need & Greptile ~15th & month-end, Treeline month-end, Nolla bi-weekly Fridays.

---

## 6. US relocation & budget

- **Office:** 731 Sansome St, SF (Financial District). Office covers **3 meals × 6 days/wk** (food ≈ $250/mo).
- **Housing:** wants a **shared room with private bathroom** or small studio. Real SF data: SF room w/ private bath ~$1,500–2,000 (often utils incl); SF studio ~$2,350–2,900; Oakland studio near BART ~$1,400–1,900 (+~$110/mo BART). **Recommended: SF room w/ private bath (~$1,800)** — walkable, private bath, most savings.
- **Two rents, no questions:** MX rent $27,000 MXN (~$1,593) + US rent (~$1,800). **Mariana: $15,000 MXN/mo** (~$885, categorized Transfer). Commuter benefit budget: **$50/mo** (pre-tax).
- **Monthly surplus (once debt-free):** ~**$8,230/mo** on full income (SF room) → ~$99k/yr; **~$4,545/mo** salary-only floor. Asia fund (3 yrs) → ~$165–290k depending on income mix.
- **Savings waterfall (Scenario B, no 401k match):** kill debt → commuter pre-tax → ~3mo emergency fund (US HYSA) → **HSA max (~$4,400, HDHP, invest, hoard receipts)** → Roth IRA max ($7k) → taxable brokerage (VTI/VT) = liquid Asia fund → **skip 401k**. Favor accessible/penalty-free accounts (he'll be US non-resident later).

**Open comp question:** whether to negotiate a single full-time role (~$170k, no gigs) — financially ~$44k/yr *less* than $150k+gigs, but removes TN-visa risk + simplifies. To *match* current take-home he'd need ~$230k+.

---

## 7. Artifacts (visuals built alongside the app)

These are **Claude Artifacts** — standalone pages, separate from the FinTracker app. They're not part of the deploy.

### Debt Tracker (live, interactive)
- **URL:** https://claude.ai/artifact/4ZPrqNCcj2VEhzrjmNGX9q
- **Source in this repo:** [`artifacts/debt-tracker.html`](artifacts/debt-tracker.html) — a single self-contained HTML file (no build step; open it directly in a browser, or publish it as an Artifact). Uses IBM Plex fonts (Google Fonts), light/dark themed, `localStorage` for the prepay-progress bar.
- **Contains:** balances by card · monthly bleed · income · monthly surplus (once debt-free) · this-month cash-flow ledger · interactive payoff calculator (slider) · prepay progress.
- **To update it:** edit `artifacts/debt-tracker.html`, then re-publish with the **Artifact tool**. Same file path in the same session keeps the URL; from a **different account/session**, publishing creates a *new* artifact (a new URL) — that's expected on the personal account. All the numbers are hard-coded near the top of the `<script>` block (`HIGH`, `TOTAL`, `BLEED`, the `ledgerData` array, the income/surplus rows) — update those to refresh it.
- To rebuild from scratch on a new account: just ask Claude to "build a debt tracker" and hand it this file as the reference.

### Inline visualizations (ephemeral)
The spending-breakdown charts (July vs Aug) and the rest-of-month cash-flow tracker were rendered **inline** via Claude's visualization tool — they were shown in-conversation, not saved as files. To regenerate: ask Claude to "chart my July vs August spending by category" or "show a cash-flow tracker for the rest of the month" and it'll rebuild them from `/api/state`.

---

## 8. Open items / standing reminders

- [ ] **OpenBank September statement** (cut ~Sep 13) — not yet added to the app.
- [ ] **Amex early-payoff quote** — request before the October prepay.
- [ ] **TN-visa side-gig legality** — consult an immigration attorney (side income on a TN is legally delicate).
- [ ] **Rotate the exposed Upstash token** (surfaced earlier; security hygiene).
- [ ] Add future MSI installments each month as new statements arrive (they don't auto-advance).

**Live Debt Tracker artifact:** https://claude.ai/artifact/4ZPrqNCcj2VEhzrjmNGX9q
(balances, monthly bleed, income, surplus, this-month cash flow, payoff calculator, prepay progress.)

---

## 9. How Diego likes to work

- **Exact, reconciled math** — verify assumptions, don't hand-wave. When reconciling statements, tie out to the peso.
- **Honest tradeoffs** — say when something's a bad idea; flag uncertainty (e.g. Amex deferred-accounting estimates vs the next statement).
- **Verify deploys** before claiming them live (build marker + 200).
- **Ask when a movement/merchant is unclear** rather than guessing categories.
- Not a licensed financial/tax/immigration advisor — give grounded estimates and point to professionals for visa/tax specifics.
