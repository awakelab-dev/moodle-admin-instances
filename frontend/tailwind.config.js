import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#011932',
        surface: '#01264c',
        'surface-muted': '#012142',
        foreground: '#f0f3fc',
        'muted-foreground': 'rgba(240, 243, 252, 0.62)',
        border: '#34547a',
        'border-soft': '#27334f',
        accent: {
          DEFAULT: '#11eaea',
          strong: '#0fced3',
        },
        brand: {
          DEFAULT: '#f0f3fc',
          strong: '#72a3c4',
        },
        destructive: '#ff8080',
        success: '#4ade80',
        chart: {
          1: '#0b93aa',
          2: '#4e7ea5',
          3: '#0fced3',
        },
      },
      borderRadius: {
        card: '8px',
        control: '4px',
      },
      fontFamily: {
        sans: ['Poppins', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
