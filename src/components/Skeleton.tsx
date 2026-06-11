"use client"
import { C } from "@/lib/utils"

/** Shimmering placeholder block. Used for loading states. */
export function Shimmer({ width = "100%", height = 16, radius = 8, style }: { width?: string | number; height?: number; radius?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: `linear-gradient(90deg, ${C.card} 0%, ${C.cardHi} 50%, ${C.card} 100%)`,
      backgroundSize: "200% 100%",
      animation: "ftShimmer 1.4s linear infinite",
      ...style,
    }} />
  )
}

/** Full-screen skeleton that mimics the Home layout — used during initial load. */
export function HomeSkeleton() {
  return (
    <div style={{ padding: "0 14px 24px" }}>
      <style jsx global>{`
        @keyframes ftShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Hero */}
      <div style={{
        background: C.elevated, border: `1px solid ${C.border}`,
        borderRadius: 22, padding: "24px 22px 22px", marginBottom: 16,
      }}>
        <Shimmer width={100} height={11} radius={4} />
        <Shimmer width={220} height={48} radius={12} style={{ marginTop: 14 }} />
        <Shimmer width={180} height={11} radius={4} style={{ marginTop: 12 }} />
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div>
            <Shimmer width={90} height={9} radius={3} />
            <Shimmer width={120} height={16} radius={5} style={{ marginTop: 6 }} />
          </div>
          <div>
            <Shimmer width={40} height={9} radius={3} />
            <Shimmer width={70} height={13} radius={5} style={{ marginTop: 6 }} />
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "14px 14px 16px" }}>
            <Shimmer width={60} height={9} radius={3} />
            <Shimmer width={100} height={20} radius={6} style={{ marginTop: 10 }} />
            <Shimmer width={70} height={9} radius={3} style={{ marginTop: 6 }} />
          </div>
        ))}
      </div>

      {/* Net worth card */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <Shimmer width={80} height={11} radius={4} />
        <Shimmer width={160} height={26} radius={8} style={{ marginTop: 8 }} />
        <Shimmer width={"100%"} height={64} radius={10} style={{ marginTop: 16 }} />
      </div>
    </div>
  )
}
