/**
 * FinTracker mark — a fan of currency banknotes ($ hero, € ¥ ₩ behind) over a
 * dark tile, with faded ¢ / ₿ in the background. Kept in sync with
 * public/icon.svg (favicon + PWA home-screen icon).
 */
export function Logo({ size = 38, radius }: { size?: number; radius?: number }) {
  // tile is drawn in a 512 viewBox; scale the corner radius to match `size`
  const rx = radius != null ? (radius / size) * 512 : 118
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="FinTracker"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect x="0" y="0" width="512" height="512" rx={rx} fill="#0E0F12" />
      <g fontFamily="sans-serif" fontWeight={700} textAnchor="middle" dominantBaseline="central">
        <text x="175" y="165" fontSize="230" fill="#FFFFFF" opacity="0.09">¢</text>
        <text x="350" y="362" fontSize="230" fill="#FFFFFF" opacity="0.09">₿</text>
        <g transform="rotate(-27 256 330)">
          <rect x="144" y="205" width="224" height="136" rx="27" fill="#A996FF" />
          <text x="256" y="273" fontSize="60" fill="#0E0F12">€</text>
        </g>
        <g transform="rotate(27 256 330)">
          <rect x="144" y="205" width="224" height="136" rx="27" fill="#FF6BAA" />
          <text x="256" y="273" fontSize="60" fill="#0E0F12">¥</text>
        </g>
        <g>
          <rect x="144" y="150" width="224" height="136" rx="27" fill="#FFC83D" />
          <text x="256" y="218" fontSize="60" fill="#0E0F12">₩</text>
        </g>
        <g>
          <rect x="132" y="212" width="248" height="152" rx="30" fill="#04D77F" />
          <text x="256" y="288" fontSize="78" fill="#0E0F12">$</text>
        </g>
      </g>
    </svg>
  )
}
