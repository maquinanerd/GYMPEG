import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

// Every color is a token from app/globals.css (HSL channels), so opacity
// modifiers work and the .dark class swaps the whole palette.
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      // GYM Peg design tokens v2 (docs/design/tailwind.gympeg.ts).
      fontFamily: {
        // Text: Archivo at 100% width.
        sans: ['var(--font-archivo)', 'sans-serif'],
        // Numbers: the same family, always with a font-stretch utility
        // (stretch-112/118/125) and tabular-nums. Use <Num> (components/ui/num).
        num: ['var(--font-archivo)', 'sans-serif'],
      },
      fontSize: {
        timer: ['6rem', { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '600' }],
        display: ['2.125rem', { lineHeight: '1.02', letterSpacing: '-0.025em', fontWeight: '600' }],
        title: ['1.75rem', { lineHeight: '1.08', letterSpacing: '-0.02em', fontWeight: '600' }],
        number: ['1.375rem', { lineHeight: '1', fontWeight: '600' }],
        heading: ['1.25rem', { lineHeight: '1.2', fontWeight: '600' }],
        subtitle: ['1.0625rem', { lineHeight: '1.3', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.45', fontWeight: '500' }],
        caption: ['0.875rem', { lineHeight: '1.4', fontWeight: '500' }],
        small: ['0.75rem', { lineHeight: '1.35', fontWeight: '500' }],
      },
      colors: {
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        primary: {
          DEFAULT: token('primary'),
          foreground: token('primary-foreground'),
        },
        secondary: {
          DEFAULT: token('secondary'),
          foreground: token('secondary-foreground'),
        },
        destructive: {
          DEFAULT: token('destructive'),
          foreground: token('destructive-foreground'),
        },
        muted: {
          DEFAULT: token('muted'),
          foreground: token('muted-foreground'),
        },
        accent: {
          DEFAULT: token('accent'),
          foreground: token('accent-foreground'),
        },
        card: {
          DEFAULT: token('card'),
          foreground: token('card-foreground'),
        },
        popover: {
          DEFAULT: token('popover'),
          foreground: token('popover-foreground'),
        },
        // #111 on light, #FFF on dark: "done" cells, the ink button, chart lines.
        ink: { DEFAULT: token('ink'), foreground: token('ink-foreground') },
        brand: { DEFAULT: token('brand') },
        'brand-strong': { DEFAULT: token('brand-strong') },
        'destructive-text': { DEFAULT: token('destructive-text') },
        'row-current': { DEFAULT: token('row-current') },
        track: { DEFAULT: token('track') },
        // Non-text elements only (dashed outlines, chevrons): too faint for text.
        subtle: { DEFAULT: token('subtle') },
        pr: { DEFAULT: token('pr'), foreground: token('pr-foreground') },
        info: { DEFAULT: token('info'), foreground: token('info-foreground') },
        warmup: { DEFAULT: token('warmup'), foreground: token('warmup-foreground') },
        deload: { DEFAULT: token('deload'), foreground: token('deload-foreground') },
        warning: { DEFAULT: token('warning'), foreground: token('warning-foreground') },
        'warning-text': { DEFAULT: token('warning-text') },
        'heat-0': { DEFAULT: token('heat-0') },
        'heat-1': { DEFAULT: token('heat-1') },
        'heat-2': { DEFAULT: token('heat-2') },
        'heat-3': { DEFAULT: token('heat-3') },
      },
      // 4 tags and highlights · 8 filters, cells, thumbnails · 12 buttons,
      // fields, the suggestion note · 16 the one white surface of a screen.
      borderRadius: {
        lg: 'var(--radius-lg)',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius)',
        sm: 'var(--radius-sm)',
        xs: 'var(--radius-xs)',
      },
      height: {
        touch: '2.75rem',
        'touch-session': '4rem',
        btn: '3.5rem',
      },
      minHeight: {
        // Minimum tap target, deliberately 4rem (64px) rather than the usual
        // 44px: these are pressed mid-set with gloved or chalky hands. The size
        // has a cost worth knowing. Three tap targets in a card's trailing
        // column is what starved the exercise name at 400px (#330, #336), so
        // widen the row or drop a control rather than shrinking this.
        tap: '4rem',
        touch: '2.75rem',
      },
      minWidth: {
        tap: '4rem',
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
    },
  },
  // An import, not require(): Node 22+ may load this file as ESM.
  plugins: [typography],
};

export default config;
