import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg:       "#0E0F12",
        surface:  "#16181C",
        card:     "#1C1E23",
        cardHi:   "#232529",
        border:   "#2A2C32",
        borderHi: "#34373E",

        text:    "#F2F2F5",
        strong:  "#FFFFFF",
        muted:   "#8E8F95",
        dim:     "#5B5D62",

        green:     "#04D77F",
        greenSoft: "#6AE8AF",
        greenDim:  "#0C2A20",
        red:       "#FF5B6B",
        redDim:    "#2A1014",
        blue:      "#47CBFF",
        blueDim:   "#0C1E2A",
        amber:     "#FF9D68",
        amberDim:  "#2A180F",
        purple:    "#A996FF",
        purpleDim: "#181230",
        teal:      "#5BD1B0",
        tealDim:   "#0C2420",
        pink:      "#EF7D98",
        pinkDim:   "#2A1018",
        sun:       "#FFC83D",

        cat: {
          food:          "#FF9D68",
          transport:     "#47CBFF",
          housing:       "#04D77F",
          health:        "#EF7D98",
          entertainment: "#A996FF",
          shopping:      "#FFC83D",
          cardPayments:  "#FF5B6B",
          pets:          "#5BD1B0",
          groceries:     "#7CDCA6",
          other:         "#8E8F95",
        },
      },
      fontFamily: {
        sans: ["Pretendard", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      fontSize: {
        // Need scale
        caption: ["10px",   { lineHeight: "14px" }],
        cap2:    ["12px",   { lineHeight: "16px" }],
        sub:     ["13px",   { lineHeight: "18px" }],
        body:    ["15px",   { lineHeight: "22px" }],
        bodyLg:  ["17px",   { lineHeight: "24px" }],
        section: ["19px",   { lineHeight: "26px", letterSpacing: "-0.2px" }],
        heroSm:  ["36px",   { lineHeight: "40px", letterSpacing: "-1px" }],
        hero:    ["42px",   { lineHeight: "46px", letterSpacing: "-1.5px" }],
      },
      borderRadius: {
        tag:  "6px",
        card: "12px",
        cardLg: "16px",
        btn:  "16px",
        pill: "100px",
      },
      spacing: {
        screen: "14px",
      },
      boxShadow: {
        glowGreen:  "0 0 32px -6px rgba(4,215,127,0.45)",
        glowAmber:  "0 0 32px -6px rgba(255,157,104,0.45)",
        glowBlue:   "0 0 32px -6px rgba(71,203,255,0.45)",
        glowRed:    "0 0 32px -6px rgba(255,91,107,0.45)",
      },
      transitionDuration: {
        flash: "300ms",
      },
    },
  },
  plugins: [],
}
export default config
