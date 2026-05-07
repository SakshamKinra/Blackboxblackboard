/** @type {import('tailwindcss').Config} */
module.exports = {
  // Enable dark mode via a CSS class on <html> (we toggle it manually)
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        // ── Brand palette ──────────────────────────────────
        gold:    '#C9A84C',
        blush:   '#ED93B1',
        lavender:'#AFA9EC',
        green:   '#1D9E75',
        // ── Dark theme ────────────────────────────────────
        dark: {
          bg:    '#0d0d1a',
          card:  '#13132b',
          text:  '#f5ecd7',
          muted: '#8878a8',
        },
        // ── Light theme ───────────────────────────────────
        light: {
          bg:    '#fdf6ee',
          card:  '#fff8f0',
          text:  '#2a1f0e',
          muted: '#9a8878',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.6s ease forwards',
        'slide-up':   'slideUp 0.5s ease forwards',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { opacity: 0, transform: 'translateY(30px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
