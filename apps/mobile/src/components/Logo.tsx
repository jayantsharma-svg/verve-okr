/**
 * Verve logo mark — a bold italic "V" in a CDP-blue rounded square.
 * Used on the login/splash screens and wherever a brand mark is needed.
 */
import { View, Text, StyleSheet } from 'react-native'
import { colors, radius, shadow } from '@/lib/theme'

interface LogoProps {
  /** Side length of the square mark in dp (default 64) */
  size?: number
  /** Show the wordmark "Verve" below the mark (default true) */
  showWordmark?: boolean
}

export function Logo({ size = 64, showWordmark = true }: LogoProps) {
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
        <View style={styles.wordmarkRow}>
          <Text style={styles.wordmark}>Verve</Text>
          <View style={styles.dot} />
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
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
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
})
