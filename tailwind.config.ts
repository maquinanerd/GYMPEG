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
      // GYM Peg design tokens (docs/design/tailwind.gympeg.ts).
      fontFamily: {
        sans: ['var(--font-urbanist)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        timer: ['4.5rem', { lineHeight: '1', fontWeight: '600' }],
        display: ['2rem', { lineHeight: '1.15', fontWeight: '600' }],
        number: ['1.75rem', { lineHeight: '1', fontWeight: '600' }],
        title: ['1.5rem', { lineHeight: '1.15', fontWeight: '600' }],
        heading: ['1.375rem', { lineHeight: '1.2', fontWeight: '600' }],
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
        brand: { DEFAULT: token('brand'), strong: token('brand-strong') },
        suggestion: { DEFAULT: token('suggestion'), foreground: token('suggestion-foreground') },
        track: { DEFAULT: token('track') },
        pill: { DEFAULT: token('pill') },
        nav: { DEFAULT: token('nav'), foreground: token('nav-foreground') },
        'nav-active': { DEFAULT: token('nav-active'), foreground: token('nav-active-foreground') },
        pr: { DEFAULT: token('pr'), foreground: token('pr-foreground') },
        info: { DEFAULT: token('info'), foreground: token('info-foreground') },
        warmup: { DEFAULT: token('warmup'), foreground: token('warmup-foreground') },
        deload: { DEFAULT: token('deload'), foreground: token('deload-foreground') },
        warning: { DEFAULT: token('warning'), foreground: token('warning-foreground') },
        success: { DEFAULT: token('success'), foreground: token('success-foreground') },
        'heat-0': { DEFAULT: token('heat-0') },
        'heat-1': { DEFAULT: token('heat-1') },
        'heat-2': { DEFAULT: token('heat-2') },
        'heat-3': { DEFAULT: token('heat-3') },
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius)',
        sm: 'var(--radius-sm)',
        pill: '9999px',
      },
      height: {
        btn: 'var(--h-btn)',
        'btn-session': 'var(--h-btn-session)',
        nav: 'var(--h-nav)',
        row: 'var(--h-row)',
      },
      minHeight: {
        // Minimum tap target, deliberately 4rem (64px) rather than the usual
        // 44px: these are pressed mid-set with gloved or chalky hands. The size
        // has a cost worth knowing. Three tap targets in a card's trailing
        // column is what starved the exercise name at 400px (#330, #336), so
        // widen the row or drop a control rather than shrinking this.
        tap: '4rem',
      },
      minWidth: {
        tap: '4rem',
      },
      boxShadow: {
        // The only glow in the app: marks content that comes from the AI.
        ai: '0 0 0 6px hsl(var(--primary) / 0.12), 0 8px 24px hsl(var(--primary) / 0.35)',
      },
    },
  },
  // An import, not require(): Node 22+ may load this file as ESM.
  plugins: [typography],
};

export default config;
