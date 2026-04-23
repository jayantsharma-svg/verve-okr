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
        ink: {
          900: '#091E42',
          800: '#1C2B4A',
          700: '#344563',
          600: '#5E6C84',
          500: '#7A869A',
          400: '#A5ADBA',
          300: '#C1C7D0',
          200: '#DFE1E6',
          100: '#EBECF0',
          50:  '#F4F5F7',
          0:   '#FFFFFF',
        },
        'cap-blue':    '#1E90D2',
        'cap-blue-d':  '#1478B3',
        'cap-blue-l':  '#E3F2FB',
        'cap-green':   '#2E8B47',
        'cap-green-l': '#E3F1E7',
        'cap-amber':   '#F2A13B',
        'cap-amber-l': '#FEF4E4',
        'cap-red':     '#E74F3C',
        'cap-red-l':   '#FEF2F2',
        'cap-purple':  '#6B4B9E',
        'cap-purple-l':'#F0EBFA',
        'cap-teal':    '#2BA39B',
        'cap-teal-l':  '#E4F6F5',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'cap-xs': '0 1px 2px rgba(9,30,66,0.06)',
        'cap-sm': '0 2px 4px rgba(9,30,66,0.08), 0 1px 2px rgba(9,30,66,0.04)',
        'cap-md': '0 6px 16px rgba(9,30,66,0.10), 0 2px 4px rgba(9,30,66,0.06)',
        'cap-lg': '0 16px 32px rgba(9,30,66,0.12), 0 4px 8px rgba(9,30,66,0.06)',
      },
    },
  },
  plugins: [],
}

export default config
