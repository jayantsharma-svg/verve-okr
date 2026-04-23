import { View, StyleSheet } from 'react-native'
import { colors } from '@/lib/theme'

interface ProgressBarProps {
  pct: number
  /** Override auto-color with a specific color */
  color?: string
  /** Bar height in dp (default 8) */
  height?: number
}

/** Returns a semantic color based on completion percentage */
function progressColor(pct: number): string {
  if (pct >= 70) return colors.green
  if (pct >= 40) return colors.amber
  return colors.red
}

export function ProgressBar({ pct, color, height = 8 }: ProgressBarProps) {
  const clamped = Math.min(Math.max(pct, 0), 100)
  const fill = color ?? progressColor(clamped)
  const br = height / 2

  return (
    <View style={[styles.track, { height, borderRadius: br }]}>
      {/* Background glow track */}
      <View
        style={[
          styles.fill,
          {
            width: `${clamped}%` as `${number}%`,
            height,
            borderRadius: br,
            backgroundColor: fill,
            opacity: clamped > 0 ? 1 : 0,
          },
        ]}
      />
    </View>
  )
}

export default ProgressBar

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.gray100,
    overflow: 'hidden',
  },
  fill: {},
})
