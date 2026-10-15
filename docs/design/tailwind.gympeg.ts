// GYM Peg — mesclar em theme.extend do tailwind.config.ts
import type { Config } from "tailwindcss";
const c = (n: string) => `hsl(var(--${n}) / <alpha-value>)`;
export const gympegTheme: NonNullable<Config["theme"]>["extend"] = {
  fontFamily: {
    sans: ["var(--font-archivo)", "sans-serif"], // texto: largura 100%
    num: ["var(--font-archivo)", "sans-serif"], // números: sempre com font-stretch 112%–125% e tabular-nums
  },
  fontSize: {
    timer: ["6rem", { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "600" }],
    display: ["2.125rem", { lineHeight: "1.02", letterSpacing: "-0.025em", fontWeight: "600" }],
    title: ["1.75rem", { lineHeight: "1.08", letterSpacing: "-0.02em", fontWeight: "600" }],
    number: ["1.375rem", { lineHeight: "1", fontWeight: "600" }],
    heading: ["1.25rem", { lineHeight: "1.2", fontWeight: "600" }],
    subtitle: ["1.0625rem", { lineHeight: "1.3", fontWeight: "600" }],
    body: ["1rem", { lineHeight: "1.45", fontWeight: "500" }],
    caption: ["0.875rem", { lineHeight: "1.4", fontWeight: "500" }],
    small: ["0.75rem", { lineHeight: "1.35", fontWeight: "500" }],
  },
  colors: {
    "ink": { DEFAULT: c("ink"), foreground: c("ink-foreground") },
    "brand": { DEFAULT: c("brand") },
    "brand-strong": { DEFAULT: c("brand-strong") },
    "destructive-text": { DEFAULT: c("destructive-text") },
    "row-current": { DEFAULT: c("row-current") },
    "track": { DEFAULT: c("track") },
    "subtle": { DEFAULT: c("subtle") },
    "pr": { DEFAULT: c("pr"), foreground: c("pr-foreground") },
    "info": { DEFAULT: c("info"), foreground: c("info-foreground") },
    "warmup": { DEFAULT: c("warmup"), foreground: c("warmup-foreground") },
    "deload": { DEFAULT: c("deload"), foreground: c("deload-foreground") },
    "warning": { DEFAULT: c("warning"), foreground: c("warning-foreground") },
    "warning-text": { DEFAULT: c("warning-text") },
    "heat-0": { DEFAULT: c("heat-0") },
    "heat-1": { DEFAULT: c("heat-1") },
    "heat-2": { DEFAULT: c("heat-2") },
    "heat-3": { DEFAULT: c("heat-3") },
  },
  borderRadius: { lg: "var(--radius-lg)", md: "var(--radius)", DEFAULT: "var(--radius)", sm: "var(--radius-sm)", xs: "var(--radius-xs)" },
  height: { "touch": "2.75rem", "touch-session": "4rem", "btn": "3.5rem" },
  transitionTimingFunction: { "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)" },
};
