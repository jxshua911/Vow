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
          gray: 'rgb(var(--vow-gray) / <alpha-value>)',
          'gray-50': 'rgb(var(--vow-gray-50) / <alpha-value>)',
          'gray-100': 'rgb(var(--vow-gray-100) / <alpha-value>)',
          'gray-200': 'rgb(var(--vow-gray-200) / <alpha-value>)',
          'gray-300': 'rgb(var(--vow-gray-300) / <alpha-value>)',
          'gray-400': 'rgb(var(--vow-gray-400) / <alpha-value>)',
          'gray-500': 'rgb(var(--vow-gray-500) / <alpha-value>)',
          'gray-600': 'rgb(var(--vow-gray-600) / <alpha-value>)',
          'gray-700': 'rgb(var(--vow-gray-700) / <alpha-value>)',
          'gray-800': 'rgb(var(--vow-gray-800) / <alpha-value>)',
          'gray-900': 'rgb(var(--vow-gray-900) / <alpha-value>)',
          'gray-950': 'rgb(var(--vow-gray-950) / <alpha-value>)',
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
