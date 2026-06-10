/**
 * Credit-card statement cycle math.
 *
 * Each card has a `cutoffDay` (day-of-month the billing period closes)
 * and a `dueDay` (day-of-month the payment is owed).
 * Convention: if dueDay < cutoffDay, the due date is in the NEXT month
 * after the cutoff (typical Mexican CC behaviour, e.g. cut 15 → due 5).
 * If dueDay >= cutoffDay, due is in the SAME month as the cutoff.
 *
 * Past-cutoff charges (≤ lastCutoff) form the "current statement balance"
 * and are owed at nextDueDate. Charges after lastCutoff are floating
 * inside the next cycle and will close at nextCutoff.
 */
export interface CardConfig {
  cutoffDay: number   // 1..31
  dueDay:    number   // 1..31
}

export interface CardCycle {
  lastCutoff:    Date  // most recent cutoff that has already passed
  nextCutoff:    Date  // next upcoming cutoff (>= today)
  statementDue:  Date  // due date for the statement that closed on lastCutoff
  daysUntilDue:  number
  overdue:       boolean
}

/** Clamp a target day into the actual month (Feb 31 → Feb 28/29). */
function clampDay(year: number, monthIdx: number, day: number): number {
  const lastDay = new Date(year, monthIdx + 1, 0).getDate()
  return Math.min(day, lastDay)
}

function buildDate(year: number, monthIdx: number, day: number): Date {
  const d = new Date(year, monthIdx, clampDay(year, monthIdx, day))
  d.setHours(0, 0, 0, 0)
  return d
}

export function computeCycle(cfg: CardConfig, now: Date = new Date()): CardCycle {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  // Determine lastCutoff: this month's cutoff if it's already passed, else previous month's.
  const thisMonthCutoff = buildDate(today.getFullYear(), today.getMonth(), cfg.cutoffDay)
  let lastCutoff: Date
  let nextCutoff: Date
  if (today >= thisMonthCutoff) {
    lastCutoff = thisMonthCutoff
    nextCutoff = buildDate(today.getFullYear(), today.getMonth() + 1, cfg.cutoffDay)
  } else {
    lastCutoff = buildDate(today.getFullYear(), today.getMonth() - 1, cfg.cutoffDay)
    nextCutoff = thisMonthCutoff
  }

  // Due date relative to lastCutoff
  const cutoffMonth = lastCutoff.getMonth()
  const cutoffYear  = lastCutoff.getFullYear()
  const sameMonthDue = cfg.dueDay >= cfg.cutoffDay
  const statementDue = buildDate(
    cutoffYear,
    sameMonthDue ? cutoffMonth : cutoffMonth + 1,
    cfg.dueDay,
  )

  const msPerDay = 86_400_000
  const daysUntilDue = Math.round((statementDue.getTime() - today.getTime()) / msPerDay)

  return {
    lastCutoff,
    nextCutoff,
    statementDue,
    daysUntilDue,
    overdue: daysUntilDue < 0,
  }
}

/**
 * Partition a card's CC charges into:
 *   statement:   charges WITHIN the most recent closed period (lastCutoff-prev .. lastCutoff]
 *                — these together with any older unpaid balance are what's due at statementDue.
 *   carryover:   anything dated BEFORE the previous cutoff that's still unpaid
 *                (rare; happens if a past statement wasn't fully settled)
 *   current:     charges in the open cycle (> lastCutoff) — closing at nextCutoff
 *
 * `chargeDates` should be the raw card charges (or already-expanded slices) for this card.
 */
export function partitionByCycle<T extends { date: string }>(
  charges: T[],
  cycle: CardCycle,
): { carryover: T[]; statement: T[]; current: T[] } {
  // Previous cutoff = one cycle before lastCutoff (same day-of-month math).
  const prev = new Date(cycle.lastCutoff)
  prev.setMonth(prev.getMonth() - 1)
  prev.setHours(0, 0, 0, 0)

  const carryover: T[] = []
  const statement: T[] = []
  const current:   T[] = []
  for (const c of charges) {
    const d = new Date(c.date + "T00:00:00")
    if (d <= prev) carryover.push(c)
    else if (d <= cycle.lastCutoff) statement.push(c)
    else current.push(c)
  }
  return { carryover, statement, current }
}

/**
 * Resolve the start/end dates of the cycle that closed in `period` ("YYYY-MM").
 * Useful for reconciling a statement against the charges that fall in its window.
 * - end   = cutoff date in `period`
 * - start = previous cycle's cutoff + 1 day (i.e. EXCLUSIVE prev cutoff)
 * The returned dates have time set to 00:00 local.
 */
export function cycleWindowForPeriod(cfg: CardConfig, period: string): { start: Date; end: Date } | null {
  const m = period.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const year = parseInt(m[1], 10)
  const monthIdx = parseInt(m[2], 10) - 1
  const end = buildDate(year, monthIdx, cfg.cutoffDay)
  // Previous cutoff was one month earlier (same day, clamped)
  const prev = buildDate(year, monthIdx - 1, cfg.cutoffDay)
  const start = new Date(prev.getTime() + 86_400_000)  // day after previous cutoff
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

export function fmtDueLabel(daysUntilDue: number): string {
  if (daysUntilDue === 0)  return "due today"
  if (daysUntilDue === 1)  return "due tomorrow"
  if (daysUntilDue > 0)    return `due in ${daysUntilDue} days`
  if (daysUntilDue === -1) return "1 day overdue"
  return `${Math.abs(daysUntilDue)} days overdue`
}
