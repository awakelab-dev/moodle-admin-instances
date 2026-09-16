import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Todos apuntan a las variables CSS de App.css (no a hex fijos): así
        // los componentes shadcn heredan el tema claro de Moodle Insights
        // igual que el resto del CSS escrito a mano, en vez de quedarse
        // siempre en la paleta oscura pase lo que pase con el tema activo.
        background: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-muted': 'var(--color-surface-muted)',
        foreground: 'var(--color-text)',
        'muted-foreground': 'var(--color-text-secondary)',
        border: 'var(--color-border)',
        'border-soft': 'var(--color-border-soft)',
        accent: {
          DEFAULT: 'var(--color-accent)',
          strong: 'var(--color-accent)',
        },
        brand: {
          DEFAULT: 'var(--color-brand)',
          strong: 'var(--color-brand-strong)',
        },
        destructive: 'var(--color-danger)',
        success: 'var(--color-success)',
        chart: {
          1: 'var(--chart-blue)',
          2: 'var(--chart-purple)',
          3: 'var(--chart-orange)',
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
