import { View, StyleSheet } from 'react-native'
import type { ViewStyle } from 'react-native'
import { colors, radius, spacing } from '@/lib/theme'

interface CardProps {
  children: React.ReactNode
  style?: ViewStyle | ViewStyle[]
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, ...(Array.isArray(style) ? style : style ? [style] : [])]}>{children}</View>
}

export default Card

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
})
