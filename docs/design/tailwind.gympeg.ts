// GYM Peg — extensão do tailwind.config.ts (mesclar em theme.extend)
import type { Config } from "tailwindcss";
const c = (n: string) => `hsl(var(--${n}) / <alpha-value>)`;
export const gympegTheme: NonNullable<Config["theme"]>["extend"] = {
  fontFamily: { sans: ["var(--font-urbanist)", "system-ui", "sans-serif"] },
  fontSize: {
    timer: ["4.5rem", { lineHeight: "1", fontWeight: "600" }],
    display: ["2rem", { lineHeight: "1.15", fontWeight: "600" }],
    number: ["1.75rem", { lineHeight: "1", fontWeight: "600" }],
    title: ["1.5rem", { lineHeight: "1.15", fontWeight: "600" }],
    heading: ["1.375rem", { lineHeight: "1.2", fontWeight: "600" }],
    subtitle: ["1.0625rem", { lineHeight: "1.3", fontWeight: "600" }],
    body: ["1rem", { lineHeight: "1.45", fontWeight: "500" }],
    caption: ["0.875rem", { lineHeight: "1.4", fontWeight: "500" }],
    small: ["0.75rem", { lineHeight: "1.35", fontWeight: "500" }],
  },
  colors: {
    "brand": { DEFAULT: c("brand") },
    "brand-strong": { DEFAULT: c("brand-strong") },
    "suggestion": { DEFAULT: c("suggestion"), foreground: c("suggestion-foreground") },
    "track": { DEFAULT: c("track") },
    "pill": { DEFAULT: c("pill") },
    "nav": { DEFAULT: c("nav"), foreground: c("nav-foreground") },
    "nav-active": { DEFAULT: c("nav-active"), foreground: c("nav-active-foreground") },
    "pr": { DEFAULT: c("pr"), foreground: c("pr-foreground") },
    "info": { DEFAULT: c("info"), foreground: c("info-foreground") },
    "warmup": { DEFAULT: c("warmup"), foreground: c("warmup-foreground") },
    "deload": { DEFAULT: c("deload"), foreground: c("deload-foreground") },
    "warning": { DEFAULT: c("warning"), foreground: c("warning-foreground") },
    "success": { DEFAULT: c("success"), foreground: c("success-foreground") },
    "heat-0": { DEFAULT: c("heat-0") },
    "heat-1": { DEFAULT: c("heat-1") },
    "heat-2": { DEFAULT: c("heat-2") },
    "heat-3": { DEFAULT: c("heat-3") },
  },
  borderRadius: { lg: "var(--radius-lg)", DEFAULT: "var(--radius)", md: "var(--radius)", sm: "var(--radius-sm)", pill: "9999px" },
  height: { btn: "var(--h-btn)", "btn-session": "var(--h-btn-session)", nav: "var(--h-nav)", row: "var(--h-row)" },
  boxShadow: { ai: "0 0 0 6px hsl(var(--primary) / 0.12), 0 8px 24px hsl(var(--primary) / 0.35)" },
};
