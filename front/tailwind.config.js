/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#E1F5EE',
          100: '#C3EBD8',
          200: '#87D7B1',
          300: '#4BC38A',
          400: '#25A96E',
          500: '#1D9E75',
          600: '#178A5F',
          700: '#117549',
          800: '#0B5F33',
          900: '#064A1E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}