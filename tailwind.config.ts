import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /** Brand primary — amber (actions, links, focus) */
        primary: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        /** Page wash */
        warm: {
          50: '#FFFBF5',
        },
        /** Deep sidebar */
        sidebar: {
          DEFAULT: '#1C1008',
          muted: '#2d1f14',
        },
      },
      boxShadow: {
        warm:
          '0 4px 24px -4px rgba(217, 119, 6, 0.12), 0 2px 8px -2px rgba(28, 16, 8, 0.06)',
        'warm-sm': '0 2px 12px -2px rgba(217, 119, 6, 0.1)',
        /** Login/register card — soft amber wash */
        'amber-100':
          '0 8px 40px -12px rgba(254, 243, 199, 0.95), 0 4px 16px -4px rgba(217, 119, 6, 0.12)',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        'paw-drift': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '120px 80px' },
        },
        'pin-step-in': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shake: 'shake 0.45s ease-in-out',
        'paw-drift': 'paw-drift 90s linear infinite',
        'pin-step-in': 'pin-step-in 0.35s ease-out both',
      },
    },
  },
  plugins: [typography],
};

export default config;
