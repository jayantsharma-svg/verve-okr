export const colors = {
  // ── Verve Brand ──────────────────────────────────────────────────────────────
  primary:      '#0F766E',   // teal-700
  primaryMid:   '#14B8A6',   // teal-500
  primaryGlow:  '#2DD4BF',   // teal-400
  primaryLight: '#ECFDF5',   // tint bg
  primaryLight2:'#F0FDFA',   // tint-2 bg
  spark:        '#FDE68A',   // summit spark / amber-200

  // ── Ink scale (slate) ────────────────────────────────────────────────────────
  gray900: '#0F172A',   // slate-900 — primary ink
  gray800: '#1E293B',
  gray700: '#334155',   // slate-700
  gray500: '#64748B',   // slate-500 — secondary text
  gray400: '#94A3B8',   // slate-400 — placeholder
  gray300: '#CBD5E1',   // slate-300
  gray200: '#E2E8F0',   // slate-200 — borders
  gray100: '#F1F5F9',   // slate-100
  gray50:  '#F8FAFC',   // slate-50 — panel bg

  white:   '#FFFFFF',

  // ── Semantic ──────────────────────────────────────────────────────────────────
  green:       '#059669',
  greenLight:  '#ECFDF5',
  greenMid:    '#10B981',
  amber:       '#D97706',
  amberLight:  '#FFFBEB',
  red:         '#DC2626',
  redLight:    '#FEF2F2',

  // ── Legacy aliases ────────────────────────────────────────────────────────────
  violet:      '#7C3AED',
  violetLight: '#EDE9FE',
  teal:        '#0F766E',
  tealLight:   '#ECFDF5',
  blue:        '#0F766E',
  blueLight:   '#ECFDF5',

  // ── Surfaces ─────────────────────────────────────────────────────────────────
  background: '#F8FAFC',
  surface:    '#FFFFFF',
}

export const spacing = {
  xs:  4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
}

export const radius = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 999,
}

export const font = {
  xs: 11, sm: 13, base: 15, md: 17, lg: 20, xl: 24, xxl: 30,
}

export const shadow = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
}
