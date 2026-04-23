/**
 * Verve logo mark — a bold italic "V" in a CDP-blue rounded square,
 * with the Capillary signature 4-dot gradient strip beneath the wordmark.
 */
import { View, Text, StyleSheet } from 'react-native'
import { colors, radius, shadow } from '@/lib/theme'

interface LogoProps {
  /** Side length of the square mark in dp (default 64) */
  size?: number
  /** Show the wordmark "Verve" below the mark (default true) */
  showWordmark?: boolean
  /** Show "by Capillary" sub-label (default true when showWordmark) */
  showSubLabel?: boolean
}

/** The 4 stops of the Capillary signature gradient, rendered as dots */
const STRIP_COLORS = ['#2FAA4E', '#1CA68F', '#1E90C7', '#1E6BBF']

export function Logo({ size = 64, showWordmark = true, showSubLabel = true }: LogoProps) {
  const fontSize = size * 0.52

  return (
    <View style={styles.wrapper}>
      {/* Mark */}
      <View
        style={[
          styles.mark,
          {
            width: size,
            height: size,
            borderRadius: size * 0.26,
          },
          shadow.lg,
        ]}
      >
        {/* Inner highlight strip — gives a subtle "lit from above" feel */}
        <View style={[styles.highlight, { borderRadius: size * 0.26 }]} />

        <Text style={[styles.letter, { fontSize, lineHeight: size * 1.05 }]}>
          V
        </Text>
      </View>

      {/* Wordmark */}
      {showWordmark && (
        <View style={styles.wordmarkBlock}>
          <View style={styles.wordmarkRow}>
            <Text style={styles.wordmark}>Verve</Text>
            <View style={styles.dot} />
          </View>

          {showSubLabel && (
            <Text style={styles.subLabel}>by Capillary</Text>
          )}

          {/* Capillary signature 4-dot accent strip */}
          <View style={styles.stripRow}>
            {STRIP_COLORS.map((c, i) => (
              <View key={i} style={[styles.stripDot, { backgroundColor: c }]} />
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

export default Logo

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  mark: {
    backgroundColor: colors.primary,  // #1E90D2 CDP blue
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  letter: {
    fontWeight: '900',
    fontStyle: 'italic',
    color: colors.white,
    letterSpacing: -2,
    textAlign: 'center',
    // nudge down slightly so it looks optically centered
    marginTop: 2,
  },
  wordmarkBlock: {
    alignItems: 'center',
    marginTop: 12,
    gap: 3,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  wordmark: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: -0.8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginBottom: 2,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray400,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  stripRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  stripDot: {
    width: 8,
    height: 4,
    borderRadius: 2,
  },
})
