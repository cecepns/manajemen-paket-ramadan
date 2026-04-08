/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8ff',
          100: '#d7edff',
          200: '#b8ddff',
          300: '#89c6ff',
          400: '#52a5ff',
          500: '#2a82f7',
          600: '#1665dc',
          700: '#1451b2',
          800: '#174591',
          900: '#1a3d76',
        },
      },
    },
  },
  plugins: [],
}

