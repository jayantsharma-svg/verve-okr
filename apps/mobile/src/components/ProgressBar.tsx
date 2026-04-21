import { View, StyleSheet } from 'react-native'
import { colors } from '@/lib/theme'

interface ProgressBarProps {
  pct: number
  color?: string
}

export function ProgressBar({ pct, color = colors.primary }: ProgressBarProps) {
  const clamped = Math.min(Math.max(pct, 0), 100)
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped}%` as `${number}%`, backgroundColor: color }]} />
    </View>
  )
}

export default ProgressBar

const styles = StyleSheet.create({
  track: { height: 6, backgroundColor: colors.gray200, borderRadius: 3, overflow: 'hidden' },
  fill:  { height: 6, borderRadius: 3 },
})
