/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Buisz merkpalet
        antraciet: {
          DEFAULT: '#13181b',
          900: '#0c1012',
          800: '#13181b',
          700: '#1b2227',
          600: '#252e34',
          500: '#33404a',
        },
        diepteal: {
          DEFAULT: '#0e4f4a',
          700: '#0a3a37',
          600: '#0e4f4a',
          500: '#14706a',
          400: '#1d938b',
        },
        buisgroen: {
          DEFAULT: '#34e3a8',
          600: '#1fb583',
          500: '#34e3a8',
          400: '#5cf0bd',
        },
        mist: {
          DEFAULT: '#e9f1f0',
          500: '#cdd9d8',
          400: '#9fb2b1',
          300: '#74898a',
        },
      },
      fontFamily: {
        sans: ['"Sora"', 'system-ui', 'sans-serif'],
        display: ['"Sora"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        focus: '0 0 0 3px rgba(52, 227, 168, 0.9), 0 12px 40px -8px rgba(52, 227, 168, 0.45)',
        glow: '0 18px 60px -12px rgba(20, 112, 106, 0.7)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease both',
        'rise-in': 'rise-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
