/**
 * Verve logo mark — twin mountain peaks with teal gradient and amber spark,
 * rendered as an inline SVG via react-native-svg.
 */
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import { colors } from '@/lib/theme'

interface LogoProps {
  /** Side length of the SVG mark in dp (default 64) */
  size?: number
  /** Show the "Verve" wordmark and tagline below the mark (default true) */
  showWordmark?: boolean
  /** White mark for use on dark backgrounds (default false) */
  reverse?: boolean
}

export function Logo({ size = 64, showWordmark = true, reverse = false }: LogoProps) {
  const backFill   = reverse ? 'rgba(255,255,255,0.45)' : '#0F766E'
  const backOpacity = reverse ? 1 : 0.35
  const frontFill  = reverse ? '#FFFFFF' : 'url(#vg)'

  return (
    <View style={styles.wrapper}>
      {/* SVG mark */}
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id="vg" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor="#0F766E" stopOpacity="1" />
            <Stop offset="1" stopColor="#14B8A6" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* Back peak */}
        <Path
          d="M4 40 L20 12 L30 30 Z"
          fill={backFill}
          opacity={backOpacity}
        />
        {/* Front peak */}
        <Path
          d="M10 40 L28 8 L44 40 Z"
          fill={frontFill}
        />
        {/* Spark */}
        <Circle cx="36" cy="12" r="3" fill="#FDE68A" />
      </Svg>

      {/* Wordmark */}
      {showWordmark && (
        <View style={styles.wordmarkBlock}>
          <Text style={[styles.wordmark, reverse && styles.wordmarkReverse]}>
            Verve
          </Text>
          <Text style={[styles.tagline, reverse && styles.taglineReverse]}>
            OKRs that move
          </Text>
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
  wordmarkBlock: {
    alignItems: 'center',
    marginTop: 10,
    gap: 2,
  },
  wordmark: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.gray900,
    letterSpacing: -0.5,
    fontFamily: 'Nunito_800ExtraBold',
  },
  wordmarkReverse: {
    color: '#FFFFFF',
  },
  tagline: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.gray500,
    letterSpacing: 0.2,
  },
  taglineReverse: {
    color: 'rgba(255,255,255,0.7)',
  },
})
