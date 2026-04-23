export const colors = {
  // ── Brand ────────────────────────────────────────────────────────────────────
  primary:      '#4F46E5',  // Indigo 600 — distinctive, professional
  primaryDark:  '#3730A3',  // Indigo 800 — depth / shadow tint
  primaryLight: '#EEF2FF',  // Indigo 50  — subtle tinted surfaces
  primaryMid:   '#6366F1',  // Indigo 500 — lighter accent

  // ── Neutrals ─────────────────────────────────────────────────────────────────
  gray900: '#111827',
  gray800: '#1F2937',
  gray700: '#374151',
  gray500: '#6B7280',
  gray400: '#9CA3AF',
  gray300: '#D1D5DB',
  gray200: '#E5E7EB',
  gray100: '#F3F4F6',
  gray50:  '#F9FAFB',
  white:   '#FFFFFF',

  // ── Semantic ──────────────────────────────────────────────────────────────────
  green:       '#16A34A',
  greenLight:  '#F0FDF4',
  greenMid:    '#22C55E',
  amber:       '#D97706',
  amberLight:  '#FFFBEB',
  red:         '#DC2626',
  redLight:    '#FEF2F2',

  // ── Legacy aliases (keep for backward compat) ────────────────────────────────
  blue:        '#4F46E5',
  blueLight:   '#EEF2FF',
  violet:      '#7C3AED',
  violetLight: '#F5F3FF',
  teal:        '#0D9488',
  tealLight:   '#F0FDFA',

  // ── Surfaces ─────────────────────────────────────────────────────────────────
  /** Screen background — barely-there lavender tint */
  background: '#F6F6FD',
  /** Card / panel background */
  surface: '#FFFFFF',
}

export const spacing = {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
}

export const radius = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   18,
  xl:   24,
  full: 9999,
}

export const font = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  30,
}

/** Reusable shadow presets (iOS shadow + Android elevation) */
export const shadow = {
  sm: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
}
