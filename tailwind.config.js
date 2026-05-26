/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        rounded: ['Gowun Dodum', 'sans-serif'],
        hand: ['Nanum Pen Script', 'cursive']
      },
      boxShadow: {
        paper: '0 16px 30px rgba(63, 52, 38, 0.16)',
        soft: '0 14px 40px rgba(59, 47, 38, 0.12)'
      }
    }
  },
  plugins: []
};
