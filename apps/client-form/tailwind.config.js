/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        'paper-deep': 'var(--paper-deep)',
        ink: 'var(--ink)',
        'gray-warm': 'var(--gray-warm)',
        'gray-soft': 'var(--gray-soft)',
        clay: 'var(--clay)',
        'clay-deep': 'var(--clay-deep)',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        editorial: '34rem',
      },
    },
  },
  plugins: [],
};
