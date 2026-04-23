export const colors = {
  // ── Brand (Capillary CDP Blue) ────────────────────────────────────────────────
  primary:      '#1E90D2',  // CDP blue
  primaryDark:  '#1478B3',  // darker blue — depth / shadow tint
  primaryLight: '#E3F2FB',  // light tint — subtle tinted surfaces
  primaryMid:   '#3DA8DC',  // mid blue — lighter accent

  // ── Neutrals (Capillary navy ink scale) ──────────────────────────────────────
  gray900: '#091E42',  // primary ink (headings/body)
  gray800: '#1C2B4A',
  gray700: '#344563',
  gray500: '#5E6C84',  // secondary text
  gray400: '#A5ADBA',  // placeholder/disabled
  gray300: '#C1C7D0',
  gray200: '#DFE1E6',  // borders
  gray100: '#EBECF0',  // hairline/subtle bg
  gray50:  '#F4F5F7',  // panel bg
  white:   '#FFFFFF',

  // ── Semantic ──────────────────────────────────────────────────────────────────
  green:       '#2E8B47',  // Capillary success
  greenLight:  '#E3F1E7',
  greenMid:    '#4AA147',
  amber:       '#F2A13B',  // Capillary warning
  amberLight:  '#FEF4E4',
  red:         '#E74F3C',  // Capillary danger
  redLight:    '#FEF2F2',

  // ── Legacy aliases (mapped to Capillary product colors) ──────────────────────
  blue:        '#1E90D2',  // → CDP blue
  blueLight:   '#E3F2FB',  // → CDP blue light
  violet:      '#6B4B9E',  // → Capillary purple
  violetLight: '#F0EBFA',
  teal:        '#2BA39B',  // → Capillary teal
  tealLight:   '#E4F6F5',

  // ── Surfaces ─────────────────────────────────────────────────────────────────
  /** Screen background */
  background: '#F4F5F7',
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
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 999,
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

/** Reusable shadow presets (iOS shadow + Android elevation) — navy-tinted */
export const shadow = {
  sm: {
    shadowColor: '#091E42',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#091E42',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#091E42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
}
