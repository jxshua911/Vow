/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        vow: {
          bg: 'rgb(var(--vow-bg) / <alpha-value>)',
          ink: 'rgb(var(--vow-ink) / <alpha-value>)',
          muted: 'rgb(var(--vow-muted) / <alpha-value>)',
          border: 'rgb(var(--vow-border) / <alpha-value>)',
          success: 'rgb(var(--vow-success) / <alpha-value>)',
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
    },
  },
  plugins: [],
};
