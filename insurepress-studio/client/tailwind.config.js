/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50: '#eef3f8', 100: '#d8e3ee', 200: '#b0c6dc', 500: '#1f4a75', 700: '#163659', 800: '#0F2942', 900: '#0a1c2e' },
        gold: { 50: '#fff8eb', 100: '#feecc7', 400: '#f59e0b', 500: '#D97706', 600: '#b45309' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'serif'],
      },
      boxShadow: { card: '0 1px 2px rgba(15,41,66,.06), 0 4px 16px rgba(15,41,66,.06)' },
    },
  },
  plugins: [],
};
