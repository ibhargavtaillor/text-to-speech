import type { Config } from 'tailwindcss';

/**
 * Design tokens live here, not in component class strings. Components reference
 * semantic names (`bg-surface`, `text-accent`) so a theme change is one edit.
 */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        bg: '#16181d',
        surface: '#1e2128',
        'surface-hover': '#262a32',
        border: '#2c2f37',
        fg: '#e8eaed',
        muted: '#9aa0a6',
        accent: {
          DEFAULT: '#ffd500',
          fg: '#16181d',
          hover: '#ffe14d',
        },
        danger: '#ffb4b4',
      },
      borderRadius: {
        pill: '999px',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      fontSize: {
        // Compact typographic scale tuned for a 320px popup.
        'xs-tight': ['11px', '14px'],
        sm: ['12px', '16px'],
        base: ['14px', '20px'],
        lg: ['15px', '22px'],
      },
      keyframes: {
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        spin: 'spin 0.7s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
