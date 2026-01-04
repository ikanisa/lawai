import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
        serif: ['var(--font-serif)', ...fontFamily.serif],
      },
      colors: {
        'legal-green': 'hsl(152 72% 37%)',
        'legal-amber': 'hsl(36 92% 54%)',
        'legal-red': 'hsl(356 78% 48%)',
      },
      boxShadow: {
        glass: '0 20px 45px -25px rgba(15, 23, 42, 0.45)',
      },
      backgroundImage: {
        'grad-1': 'linear-gradient(135deg, var(--grad-teal), var(--grad-indigo))',
        'grad-2': 'linear-gradient(135deg, var(--grad-violet), var(--grad-rose))',
      },
      backdropBlur: {
        glass: '22px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
