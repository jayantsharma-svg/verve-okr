import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Nunito', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },

        // Ink scale (slate-based)
        ink: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          200: '#E2E8F0',
          100: '#F1F5F9',
          50:  '#F8FAFC',
          0:   '#FFFFFF',
        },

        // Verve brand
        'verve':       '#0F766E',
        'verve-mid':   '#14B8A6',
        'verve-glow':  '#2DD4BF',
        'verve-d':     '#0D5F58',  // darker shade for hover
        'verve-l':     '#ECFDF5',  // light tint bg
        'verve-l2':    '#F0FDFA',  // very light tint
        'spark':       '#FDE68A',  // summit spark

        // Semantic
        'cap-green':    '#059669',
        'cap-green-l':  '#ECFDF5',
        'cap-amber':    '#D97706',
        'cap-amber-l':  '#FFFBEB',
        'cap-red':      '#DC2626',
        'cap-red-l':    '#FEF2F2',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'cap-xs': '0 1px 2px rgba(15,23,42,0.06)',
        'cap-sm': '0 2px 4px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)',
        'cap-md': '0 6px 16px rgba(15,23,42,0.10), 0 2px 4px rgba(15,23,42,0.06)',
        'cap-lg': '0 16px 32px rgba(15,23,42,0.12), 0 4px 8px rgba(15,23,42,0.06)',
      },
    },
  },
  plugins: [],
}

export default config
