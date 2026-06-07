import type { Config } from "tailwindcss"
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg:      "#0A0A0F",
        surface: "#111118",
        card:    "#16161F",
        border:  "#1E1E2E",
        hi:      "#2A2A3E",
        text:    "#F0F0FF",
        muted:   "#6B6B8A",
        dim:     "#3A3A55",
        green:   "#00E5A0",
        red:     "#FF5B6B",
        blue:    "#5B9FFF",
        amber:   "#FFB547",
        purple:  "#A78BFA",
      }
    }
  },
  plugins: []
}
export default config
