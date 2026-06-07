import { NextResponse } from "next/server"
import { getState } from "@/lib/state"
import { expandCC } from "@/lib/utils"

export async function GET() {
  const state = await getState()
  const ccExpanded = expandCC(state.cc)

  // Build CSV rows
  const rows: string[] = [
    "type,date,name,amount_mxn,amount_usd,category,card,note,gf,inv_type"
  ]

  for (const e of state.expenses) {
    rows.push(`expense,${e.date},"${e.name}",${e.amount},,${e.cat},,${e.note ?? ""},,`)
  }
  for (const e of state.income) {
    rows.push(`income,${e.date},"${e.name}",,${e.amount},,,"${e.note ?? ""}",,`)
  }
  for (const e of ccExpanded) {
    rows.push(`cc,${e.date},"${e.name}",${e.amount},,${e.cat},${e.card},,,`)
  }
  for (const e of state.investments) {
    rows.push(`investment,${e.date},"${e.name}",${e.amount},,,,,"${e.note ?? ""}",${e.gf},${e.inv_type}`)
  }

  const csv = rows.join("\n")
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="fintracker-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}
