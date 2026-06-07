import * as React from "react"

export const ICON_PATHS: Record<string, string> = {
  overview:  "M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z",
  cards:     "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm0 3h18",
  expenses:  "M6 3h12v18l-3-2-3 2-3-2-3 2V3zm3 5h6M9 12h6",
  income:    "M12 4v16m0-16-4 4m4-4 4 4M5 20h14",
  invest:    "M4 19V5m0 14h16M7 15l3.5-4 3 2.5L20 7",
  search:    "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5",
  close:     "M6 6l12 12M18 6L6 18",
  plus:      "M12 5v14M5 12h14",
  chevL:     "M15 5l-7 7 7 7",
  chevR:     "M9 5l7 7-7 7",
  refresh:   "M20 11a8 8 0 1 0-.6 4M20 5v6h-6",
  check:     "M5 12l4.5 4.5L19 7",
  warning:   "M12 3l9.5 17H2.5L12 3zm0 6v5m0 3v.5",
  trash:     "M4 7h16M9 7V4h6v3m-8 0v13h10V7M10 11v5m4-5v5",
}

interface IconProps {
  name: keyof typeof ICON_PATHS | string
  size?: number
  color?: string
  stroke?: number
  fill?: boolean
  style?: React.CSSProperties
}

export function Icon({ name, size = 22, color = "currentColor", stroke = 1.8, fill = false, style }: IconProps) {
  const d = ICON_PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: "block", flexShrink: 0, ...style }}
      fill={fill ? color : "none"}
      stroke={fill ? "none" : color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}
