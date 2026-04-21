import { View, Text, StyleSheet } from 'react-native'
import { colors, radius } from '@/lib/theme'

const CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  on_track:  { label: 'On Track',  bg: colors.greenLight, text: colors.green },
  at_risk:   { label: 'At Risk',   bg: colors.amberLight, text: colors.amber },
  off_track: { label: 'Off Track', bg: colors.redLight,   text: colors.red },
}

interface ConfidenceBadgeProps {
  confidence: string
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const cfg = CONFIG[confidence] ?? CONFIG['on_track']!
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.label, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  )
}

export default ConfidenceBadge

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  label: { fontSize: 11, fontWeight: '600' },
})
