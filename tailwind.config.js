/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ec',
          100: '#ffe8bf',
          200: '#ffd288',
          300: '#ffbc59',
          400: '#ffa630',
          500: '#f58416',
          600: '#d4630d',
          700: '#ae470f',
          800: '#8d3914',
          900: '#733013',
        },
        teal: {
          50: '#eefdfb',
          100: '#c5fbf2',
          200: '#8af4e6',
          300: '#4ce8d8',
          400: '#1bd0c3',
          500: '#10b5aa',
          600: '#12918a',
          700: '#167470',
          800: '#195c59',
          900: '#1a4d4c',
        },
      },
      boxShadow: {
        soft: '0 24px 60px -26px rgba(15, 23, 42, 0.26)',
      },
      fontFamily: {
        sans: ['Manrope', 'Segoe UI', 'sans-serif'],
        serif: ['Manrope', 'Segoe UI', 'sans-serif'],
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};
