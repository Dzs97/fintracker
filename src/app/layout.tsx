import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "FinTracker",
  description: "Personal finance tracker",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  themeColor: "#0E0F12",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text antialiased">{children}</body>
    </html>
  )
}
